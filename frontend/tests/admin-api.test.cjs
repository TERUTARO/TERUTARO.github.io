// Run: node --test tests/admin-api.test.cjs (no AWS requests are made).
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "terutaro-admin-tests-"));
for (const name of ["admin-api", "admin-auth", "admin-content"]) {
  const source = fs.readFileSync(path.join(__dirname, "../src/lib", `${name}.ts`), "utf8");
  fs.writeFileSync(path.join(directory, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText);
}
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const { AdminSession } = require(path.join(directory, "admin-auth.js"));
const { AdminApi, loadAdminConfig } = require(path.join(directory, "admin-api.js"));
const { prepareContent, validateContent } = require(path.join(directory, "admin-content.js"));
const config = { apiBaseUrl: "https://api.example.test", region: "ap-northeast-1", userPoolId: "ap-northeast-1_test", clientId: "testclient" };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const authResult = (access = "access-only", expires = 3600) => ({ AuthenticationResult: { AccessToken: access, IdToken: "never-sent-to-api", RefreshToken: "refresh-memory", ExpiresIn: expires } });
const sample = { id: "service-4", category: "ミドルウェア", product: "Apache", item: "基本設定", unit: "1サーバにつき", notes: "条件を保持", priceYen: 3000, sourceRow: 4, order: 0, published: true };

test("protected API never fetches before login", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return response({}); };
  const session = new AdminSession(config, () => {}, fetcher);
  await assert.rejects(new AdminApi(config, session, fetcher).list("projects"), /ログイン/);
  assert.equal(calls, 0);
});

test("access token authorizes versioned PUT and preserves source fields", async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body || "{}") });
    return url.includes("cognito-idp") ? response(authResult()) : response({ id: sample.id, data: sample, version: 3, updatedAt: "2026-10-01T00:00:00Z" });
  };
  const session = new AdminSession(config, () => {}, fetcher);
  await session.login("admin", "test-password");
  await new AdminApi(config, session, fetcher).save("services", sample.id, sample, 2);
  assert.equal(requests[0].body.AuthFlow, "USER_PASSWORD_AUTH");
  assert.equal(requests[1].options.headers.Authorization, "Bearer access-only");
  assert.equal(requests[1].body.version, 2);
  assert.equal(requests[1].body.data.sourceRow, 4);
  assert.equal(requests[1].body.data.notes, "条件を保持");
  assert.ok(!JSON.stringify(requests[1]).includes("never-sent-to-api"));
});

test("near expiry refresh completes before mutation and is shared", async () => {
  let count = 0;
  const fetcher = async (_url, options) => {
    count++;
    const body = JSON.parse(options.body);
    return body.AuthFlow === "USER_PASSWORD_AUTH" ? response(authResult("old", 30)) : response(authResult("refreshed"));
  };
  const session = new AdminSession(config, () => {}, fetcher);
  await session.login("admin", "test-password");
  assert.deepEqual(await Promise.all([session.accessToken(), session.accessToken()]), ["refreshed", "refreshed"]);
  assert.equal(count, 2);
});

test("failed refresh blocks mutation, expires session, and never calls API", async () => {
  let expired = 0, apiCalls = 0;
  const fetcher = async (url, options) => {
    if (!url.includes("cognito-idp")) { apiCalls++; return response({}); }
    return JSON.parse(options.body).AuthFlow === "USER_PASSWORD_AUTH" ? response(authResult("old", 30)) : response({ __type: "NotAuthorizedException" }, 400);
  };
  const session = new AdminSession(config, () => expired++, fetcher);
  await session.login("admin", "test-password");
  await assert.rejects(new AdminApi(config, session, fetcher).save("services", sample.id, sample, 2));
  assert.equal(apiCalls, 0); assert.equal(expired, 1);
  await assert.rejects(session.accessToken(), /ログイン/);
});

test("logout invalidates an in-flight refresh and cannot resurrect it", async () => {
  let finish;
  const fetcher = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.AuthFlow === "USER_PASSWORD_AUTH") return response(authResult("old", 30));
    if (body.AuthFlow === "REFRESH_TOKEN_AUTH") return new Promise(resolve => { finish = resolve; });
    return response({});
  };
  const session = new AdminSession(config, () => {}, fetcher);
  await session.login("admin", "test-password");
  const refreshing = session.accessToken();
  await session.logout(); finish(response(authResult("must-not-return")));
  await assert.rejects(refreshing); await assert.rejects(session.accessToken());
});

test("first-login challenge submits required attributes and new password", async () => {
  const requests = [];
  const fetcher = async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return requests.length === 1 ? response({ ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "challenge-session", ChallengeParameters: { requiredAttributes: '["userAttributes.email"]', USER_ID_FOR_SRP: "canonical-user" } }) : response(authResult());
  };
  const session = new AdminSession(config, () => {}, fetcher);
  assert.deepEqual(await session.login("admin", "temporary"), { username: "admin", requiredAttributes: ["email"] });
  await assert.rejects(session.accessToken());
  await session.completeNewPassword("new-password", { email: "test@example.com" });
  assert.deepEqual(requests[1].ChallengeResponses, { USERNAME: "canonical-user", NEW_PASSWORD: "new-password", "userAttributes.email": "test@example.com" });
  assert.equal(await session.accessToken(), "access-only");
});

test("409 does not retry or overwrite; 401 clears the session", async () => {
  let errorStatus = 409, calls = 0, expired = 0;
  const fetcher = async (url) => {
    if (url.includes("cognito-idp")) return response(authResult());
    calls++; return response({ error: "CONFLICT", message: "conflict" }, errorStatus);
  };
  const session = new AdminSession(config, () => expired++, fetcher);
  await session.login("admin", "test-password");
  const api = new AdminApi(config, session, fetcher);
  await assert.rejects(api.save("services", sample.id, sample, 2), error => error.status === 409);
  assert.equal(calls, 1); assert.equal(sample.priceYen, 3000);
  errorStatus = 401;
  await assert.rejects(api.save("services", sample.id, sample, 2), error => error.status === 401);
  assert.equal(calls, 2); assert.equal(expired, 1);
  await assert.rejects(session.accessToken());
});

test("logout clears local session even if GlobalSignOut fails", async () => {
  const fetcher = async (_url, options) => options.headers["X-Amz-Target"].endsWith("GlobalSignOut") ? response({}, 500) : response(authResult());
  const session = new AdminSession(config, () => {}, fetcher);
  await session.login("admin", "test-password");
  assert.equal(await session.logout(), false);
  await assert.rejects(session.accessToken());
});

test("config and partner URL input reject insecure destinations", async () => {
  await assert.rejects(loadAdminConfig(async () => response({ ...config, apiBaseUrl: "http://bad.example" })));
  const partner = { id: "partner", name: "会社", summary: "紹介", tags: [], sites: [{ label: "サイト", url: "javascript:alert(1)" }], order: 0, published: true };
  assert.match(validateContent("partners", partner), /URL/);
  const data = prepareContent("services", { ...sample, futureField: { retain: true } });
  assert.equal(data.sourceRow, 4); assert.deepEqual(data.futureField, { retain: true });
  const clean = prepareContent("partners", { ...partner, sites: [{ label: "サイト", url: "https://example.com", previewKey: "" }] });
  assert.ok(!("previewKey" in clean.sites[0]));
});
