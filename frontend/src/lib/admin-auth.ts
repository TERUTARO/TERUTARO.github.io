import { AdminError, object, type AdminConfig, type Fetcher } from "./admin-api";

export interface PasswordChallenge { username: string; requiredAttributes: string[] }
interface Tokens { access: string; refresh: string; expiresAt: number }

const authenticationMessages: Record<string, string> = {
  NotAuthorizedException: "IDまたはパスワードが正しくないか、ログインの有効期限が切れています。",
  UserNotFoundException: "IDまたはパスワードが正しくありません。",
  InvalidPasswordException: "パスワードが条件を満たしていません。長さや文字の組み合わせを確認してください。",
  PasswordHistoryPolicyViolationException: "過去に使用したパスワードは使えません。別のパスワードを指定してください。",
  PasswordResetRequiredException: "パスワードの再設定が必要です。管理者にご連絡ください。",
  TooManyRequestsException: "試行回数が多いため、少し待ってから再度お試しください。",
  LimitExceededException: "操作回数の上限に達しました。少し待ってから再度お試しください。",
  UserNotConfirmedException: "このアカウントはまだ利用開始できません。管理者にご連絡ください。",
};

/** Tokens are held only in this instance, never in web storage or cookies. */
export class AdminSession {
  private tokens: Tokens | null = null;
  private challenge: { session: string; username: string; requiredAttributes: string[] } | null = null;
  private refreshing: Promise<string> | null = null;
  private generation = 0;
  username = "";

  constructor(private config: AdminConfig, private onExpired: () => void, private fetcher: Fetcher = fetch) {}

  private async cognito(action: string, body: unknown): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetcher(`https://cognito-idp.${this.config.region}.amazonaws.com/`, {
        method: "POST", credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}` },
        body: JSON.stringify(body),
      });
    } catch { throw new AdminError("認証サービスに接続できませんでした。接続を確認してください。"); }
    const raw = object(await response.json().catch(() => ({})));
    if (!response.ok) {
      const code = String(raw.__type || raw.code || "").split("#").pop() || "";
      throw new AdminError(authenticationMessages[code] || "認証操作を完了できませんでした。入力内容や接続設定を確認してください。", response.status, code);
    }
    return raw;
  }

  private accept(result: unknown, refresh = "") {
    const raw = object(result);
    if (typeof raw.AccessToken !== "string" || typeof raw.ExpiresIn !== "number" || raw.ExpiresIn <= 0) {
      throw new AdminError("ログイン情報を取得できませんでした。再度ログインしてください。");
    }
    this.tokens = { access: raw.AccessToken, refresh: typeof raw.RefreshToken === "string" ? raw.RefreshToken : refresh,
      expiresAt: Date.now() + raw.ExpiresIn * 1000 };
    this.challenge = null;
  }

  async login(username: string, password: string): Promise<PasswordChallenge | null> {
    this.clear();
    const generation = this.generation;
    const raw = await this.cognito("InitiateAuth", { AuthFlow: "USER_PASSWORD_AUTH", ClientId: this.config.clientId,
      AuthParameters: { USERNAME: username, PASSWORD: password } });
    if (generation !== this.generation) throw new AdminError("ログイン操作を中断しました。");
    this.username = username;
    if (raw.ChallengeName === "NEW_PASSWORD_REQUIRED" && typeof raw.Session === "string") {
      const parameters = object(raw.ChallengeParameters);
      let required: unknown = [];
      try { required = JSON.parse(String(parameters.requiredAttributes || "[]")); } catch { /* Invalid challenge is rejected below. */ }
      if (!Array.isArray(required) || !required.every(item => typeof item === "string")) throw new AdminError("初回ログイン情報を確認できませんでした。");
      const requiredAttributes = required.map((item: string) => item.replace(/^userAttributes\./, ""));
      const challengeUsername = typeof parameters.USER_ID_FOR_SRP === "string" ? parameters.USER_ID_FOR_SRP : username;
      this.challenge = { session: raw.Session, username: challengeUsername, requiredAttributes };
      return { username, requiredAttributes };
    }
    if (raw.ChallengeName) throw new AdminError("このログインには追加の認証設定が必要です。管理者にご連絡ください。");
    this.accept(raw.AuthenticationResult);
    return null;
  }

  async completeNewPassword(password: string, attributes: Record<string, string>): Promise<void> {
    const challenge = this.challenge;
    const generation = this.generation;
    if (!challenge) throw new AdminError("初回ログインの有効期限が切れました。もう一度ログインしてください。");
    const responses: Record<string, string> = { USERNAME: challenge.username, NEW_PASSWORD: password };
    for (const name of challenge.requiredAttributes) {
      if (!attributes[name]?.trim()) throw new AdminError("必要なアカウント情報を入力してください。");
      responses[`userAttributes.${name}`] = attributes[name].trim();
    }
    const raw = await this.cognito("RespondToAuthChallenge", { ClientId: this.config.clientId,
      ChallengeName: "NEW_PASSWORD_REQUIRED", Session: challenge.session, ChallengeResponses: responses });
    if (generation !== this.generation) throw new AdminError("ログイン操作を中断しました。");
    if (raw.ChallengeName) throw new AdminError("追加の認証設定が必要です。管理者にご連絡ください。");
    this.accept(raw.AuthenticationResult);
  }

  async accessToken(): Promise<string> {
    if (!this.tokens) throw new AdminError("ログインしてください。", 401, "UNAUTHORIZED");
    if (this.tokens.expiresAt > Date.now() + 60000) return this.tokens.access;
    if (this.refreshing) return this.refreshing;
    const refresh = this.tokens.refresh;
    const generation = this.generation;
    if (!refresh) { this.expire(); throw new AdminError("ログインの有効期限が切れました。再ログインしてください。", 401); }
    this.refreshing = (async () => {
      try {
        const raw = await this.cognito("InitiateAuth", { AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: this.config.clientId,
          AuthParameters: { REFRESH_TOKEN: refresh } });
        if (generation !== this.generation) throw new AdminError("ログイン状態が変わりました。操作をやり直してください。", 401);
        this.accept(raw.AuthenticationResult, refresh);
        return this.tokens!.access;
      } catch (error) {
        if (generation === this.generation) this.expire();
        throw error;
      } finally { if (generation === this.generation) this.refreshing = null; }
    })();
    return this.refreshing;
  }

  async changePassword(previousPassword: string, proposedPassword: string): Promise<void> {
    const access = await this.accessToken();
    try { await this.cognito("ChangePassword", { AccessToken: access, PreviousPassword: previousPassword, ProposedPassword: proposedPassword }); }
    catch (error) {
      // A wrong previous password also reports NotAuthorizedException; keep the
      // current session and let the administrator correct the password.
      throw error;
    }
  }

  clear() { this.generation += 1; this.tokens = null; this.challenge = null; this.refreshing = null; }
  expire() { this.clear(); this.onExpired(); }
  async logout(): Promise<boolean> {
    const access = this.tokens?.access;
    this.clear();
    if (!access) return true;
    try { await this.cognito("GlobalSignOut", { AccessToken: access }); return true; }
    catch { return false; }
  }
}
