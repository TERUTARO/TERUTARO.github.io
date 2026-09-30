"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminApi, collections, loadAdminConfig, messageOf, type Collection } from "@/lib/admin-api";
import { AdminSession } from "@/lib/admin-auth";
import { collectionLabels } from "@/lib/admin-content";
import { AdminLogin, AdminPassword } from "./admin-auth-forms";
import { AdminContacts } from "./admin-contacts";
import { AdminContentPanel } from "./admin-content-panel";

type View = "contacts" | Collection | "account";
const navIcons: Record<View, string> = { contacts: "↙", projects: "◇", skills: "⌘", partners: "↔", services: "▤", engineers: "◷", advisory: "◎", account: "⚙" };

export function AdminConsole() {
  const [connection, setConnection] = useState<{ session: AdminSession; api: AdminApi } | null>(null);
  const [configError, setConfigError] = useState("");
  const [retry, setRetry] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [expired, setExpired] = useState(false);
  const [view, setView] = useState<View>("contacts");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState("");
  const setDirtyFlag = useCallback((value: boolean) => setDirty(value), []);
  const setBusyFlag = useCallback((value: boolean) => setBusy(value), []);

  useEffect(() => {
    let cancelled = false;
    let session: AdminSession | undefined;
    setConfigError("");
    loadAdminConfig().then(config => {
      if (cancelled) return;
      session = new AdminSession(config, () => { setAuthenticated(false); setExpired(true); });
      setConnection({ session, api: new AdminApi(config, session) });
    }).catch(error => { if (!cancelled) setConfigError(messageOf(error)); });
    return () => { cancelled = true; session?.clear(); };
  }, [retry]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty, busy]);

  const canLeave = useCallback(() => {
    if (busy) return false;
    return !dirty || window.confirm("未保存の変更があります。変更を破棄して移動しますか？");
  }, [dirty, busy]);

  function navigate(next: View) {
    if (view === next || !canLeave()) return;
    setDirty(false); setView(next);
  }
  async function logout() {
    if (!connection || !canLeave()) return;
    setBusy(true);
    const remotelySignedOut = await connection.session.logout();
    setAuthenticated(false); setHasWorkspace(false); setExpired(false); setDirty(false); setBusy(false); setView("contacts");
    setLogoutNotice(remotelySignedOut ? "ログアウトしました。" : "この画面からログアウトしました。認証サービス側のログアウトは確認できませんでした。");
  }
  const navItems: { id: View; label: string }[] = [{ id: "contacts", label: "お問い合わせ" },
    ...collections.map(id => ({ id, label: collectionLabels[id] })), { id: "account", label: "パスワード変更" }];

  return <div className="admin-app">
    <a className="admin-skip" href="#admin-main">本文へスキップ</a>
    <header className="admin-header"><a href="/admin.html" className="admin-brand" onClick={event => { if (!canLeave()) event.preventDefault(); }}>terutaro<span>管理画面</span></a><div className="admin-header-actions">{authenticated && <><span className="admin-user-label">{connection?.session.username}</span><button type="button" className="admin-text-button" disabled={busy} onClick={logout}>ログアウト</button></>}</div></header>
    {!connection ? <main id="admin-main" className="admin-login-layout"><section className="admin-login-card"><span className="admin-kicker">PRIVATE WORKSPACE</span><h1>管理画面</h1>{configError ? <><p className="admin-alert admin-alert-error" role="alert">{configError}</p><button type="button" className="admin-button" onClick={() => setRetry(value => value + 1)}>設定を再確認</button></> : <p role="status">接続設定を確認しています…</p>}</section></main> : <>
      {!authenticated && <main id={hasWorkspace ? "admin-login" : "admin-main"} className="admin-login-layout">{logoutNotice && <p role="status" className="admin-logout-notice">{logoutNotice}</p>}<AdminLogin session={connection.session} expired={expired} onLogin={() => { setAuthenticated(true); setHasWorkspace(true); setExpired(false); setLogoutNotice(""); }}/></main>}
      {hasWorkspace && <div className="admin-shell" hidden={!authenticated}>
        <aside className="admin-sidebar"><p>WORKSPACE</p><nav aria-label="管理メニュー">{navItems.map(item => <button type="button" key={item.id} onClick={() => navigate(item.id)} disabled={busy || !authenticated} aria-current={view === item.id ? "page" : undefined}><span aria-hidden="true">{navIcons[item.id]}</span>{item.label}</button>)}</nav><div className="admin-sidebar-note">公開状態と表示順は<br/>各編集画面で変更できます。</div></aside>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {view === "contacts" ? <AdminContacts api={connection.api} enabled={authenticated} onBusy={setBusyFlag}/> :
            view === "account" ? <AdminPassword session={connection.session} onDirty={setDirtyFlag} onBusy={setBusyFlag}/> :
              <AdminContentPanel key={view} collection={view} api={connection.api} enabled={authenticated} canLeave={canLeave} onDirty={setDirtyFlag} onBusy={setBusyFlag}/>}
        </main>
      </div>}
    </>}
  </div>;
}
