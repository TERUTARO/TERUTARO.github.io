import type { AdminSession } from "./admin-auth";

export const collections = ["projects", "skills", "partners", "services", "engineers", "advisory"] as const;
export type Collection = (typeof collections)[number];
export type ContentData = Record<string, unknown> & { id: string; order: number; published: boolean };
export interface ContentRecord { id: string; data: ContentData; version: number; updatedAt: string }
export type ContactStatus = "new" | "read" | "archived";
export interface ContactRecord {
  id: string; name: string; company: string; email: string; type: string; message: string;
  createdAt: string; status: ContactStatus; version: number;
}
export interface AdminConfig { apiBaseUrl: string; region: string; userPoolId: string; clientId: string }
export type Fetcher = typeof fetch;

export class AdminError extends Error {
  constructor(message: string, public status = 0, public code = "") { super(message); }
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "操作を完了できませんでした。もう一度お試しください。";
}

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function loadAdminConfig(fetcher: Fetcher = fetch): Promise<AdminConfig> {
  const response = await fetcher("/admin-config.json", { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new AdminError("管理画面の接続設定がまだありません。設定の反映後に再読み込みしてください。");
  const raw = object(await response.json());
  if (!["apiBaseUrl", "region", "userPoolId", "clientId"].every(key => typeof raw[key] === "string" && raw[key])) {
    throw new AdminError("管理画面の接続設定が未完了です。APIとログイン設定を確認してください。");
  }
  const url = new URL(raw.apiBaseUrl as string);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !/^[a-z]{2}-[a-z]+-\d$/.test(raw.region as string) ||
      !(raw.userPoolId as string).startsWith(`${raw.region}_`) ||
      !/^[\w+]+$/.test(raw.clientId as string)) {
    throw new AdminError("管理画面の接続設定が正しくありません。管理者に確認してください。");
  }
  return { apiBaseUrl: url.href.replace(/\/$/, ""), region: raw.region as string,
    userPoolId: raw.userPoolId as string, clientId: raw.clientId as string };
}

function contentRecord(value: unknown): ContentRecord {
  const raw = object(value);
  const data = object(raw.data);
  if (typeof raw.id !== "string" || !Number.isInteger(raw.version) || typeof raw.updatedAt !== "string" || data.id !== raw.id) {
    throw new AdminError("保存データの形式を確認できませんでした。再読み込みしてください。");
  }
  return raw as unknown as ContentRecord;
}

function contactRecord(value: unknown): ContactRecord {
  const raw = object(value);
  if (!["id", "name", "email", "message", "createdAt"].every(key => typeof raw[key] === "string") ||
      !Number.isInteger(raw.version) || !["new", "read", "archived"].includes(String(raw.status))) {
    throw new AdminError("お問い合わせの形式を確認できませんでした。再読み込みしてください。");
  }
  return raw as unknown as ContactRecord;
}

export class AdminApi {
  constructor(private config: AdminConfig, private session: AdminSession, private fetcher: Fetcher = fetch) {}

  private async request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    // Obtain a fresh token before every request, including every mutation.
    const accessToken = await this.session.accessToken();
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.apiBaseUrl}${path}`, {
        method, cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new AdminError(method === "GET" ? "通信できませんでした。接続を確認して再読み込みしてください。" :
        "保存結果を確認できませんでした。入力は残っています。再送信の前に一覧を読み直して保存状況を確認してください。");
    }
    if (response.status === 401) {
      this.session.expire();
      throw new AdminError("ログインの有効期限が切れました。再ログインしてから操作してください。入力内容は保持しています。", 401, "UNAUTHORIZED");
    }
    const payload = response.status === 204 ? {} : object(await response.json().catch(() => ({})));
    if (!response.ok) {
      if (response.status === 409) throw new AdminError("別の更新と競合しました。入力内容は保持しています。最新データを確認してから、編集し直してください。", 409, "CONFLICT");
      if (response.status === 403) throw new AdminError("このアカウントには管理画面を操作する権限がありません。", 403, "FORBIDDEN");
      throw new AdminError(typeof payload.message === "string" ? payload.message : "操作を完了できませんでした。もう一度お試しください。", response.status, String(payload.error || ""));
    }
    return payload;
  }

  async list(collection: Collection): Promise<ContentRecord[]> {
    const raw = object(await this.request(`/admin/content/${collection}`));
    if (!Array.isArray(raw.items)) throw new AdminError("一覧を取得できませんでした。再読み込みしてください。");
    return raw.items.map(contentRecord).sort((a, b) => Number(a.data.order || 0) - Number(b.data.order || 0) || a.id.localeCompare(b.id));
  }
  async save(collection: Collection, id: string, data: ContentData, version: number | null): Promise<ContentRecord> {
    return contentRecord(await this.request(`/admin/content/${collection}/${encodeURIComponent(id)}`, "PUT", { data, version }));
  }
  async remove(collection: Collection, record: ContentRecord): Promise<void> {
    await this.request(`/admin/content/${collection}/${encodeURIComponent(record.id)}`, "DELETE", { version: record.version });
  }
  async contacts(cursor?: string): Promise<{ items: ContactRecord[]; nextCursor: string | null }> {
    const raw = object(await this.request(`/admin/contacts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`));
    if (!Array.isArray(raw.items)) throw new AdminError("お問い合わせ一覧を取得できませんでした。");
    return { items: raw.items.map(contactRecord), nextCursor: typeof raw.nextCursor === "string" ? raw.nextCursor : null };
  }
  async contactStatus(contact: ContactRecord, status: ContactStatus): Promise<ContactRecord> {
    return contactRecord(await this.request(`/admin/contacts/${encodeURIComponent(contact.id)}`, "PATCH", { status, version: contact.version }));
  }
}
