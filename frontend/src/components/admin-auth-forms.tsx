"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { messageOf } from "@/lib/admin-api";
import type { AdminSession, PasswordChallenge } from "@/lib/admin-auth";

export function AdminLogin({ session, onLogin, expired }: { session: AdminSession; onLogin: () => void; expired: boolean }) {
  const [username, setUsername] = useState(session.username);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [challenge, setChallenge] = useState<PasswordChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (challenge && newPassword !== confirmation) { setError("新しいパスワードと確認用の入力が一致しません。"); return; }
    busy.current = true; setLoading(true); setError("");
    try {
      if (challenge) {
        await session.completeNewPassword(newPassword, attributes);
        setNewPassword(""); setConfirmation(""); onLogin();
      } else {
        const next = await session.login(username.trim(), password);
        setPassword("");
        if (next) setChallenge(next); else onLogin();
      }
    } catch (problem) { setError(messageOf(problem)); setPassword(""); }
    finally { busy.current = false; setLoading(false); }
  }
  return <section className="admin-login-card" aria-labelledby="admin-login-heading"><span className="admin-kicker">PRIVATE WORKSPACE</span><h1 id="admin-login-heading">{challenge ? "初回パスワードの設定" : "管理画面へログイン"}</h1><p>{challenge ? "仮パスワードを、ご自身のパスワードに変更してください。" : "管理者のIDとパスワードを入力してください。"}</p>
    {expired && <p className="admin-alert">ログインの有効期限が切れました。編集中の内容は、この画面を開いている間は保持しています。同じIDで再ログインしてください。</p>}
    <form onSubmit={submit}><fieldset className="admin-fieldset" disabled={loading}>
      {!challenge ? <><label className="admin-field"><span>ログインID</span><input name="username" autoComplete="username" required maxLength={128} value={username} readOnly={expired && Boolean(session.username)} onChange={event => setUsername(event.target.value)} autoFocus/></label><label className="admin-field"><span>パスワード</span><input name="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)}/></label></> :
        <><label className="admin-field"><span>新しいパスワード</span><input name="new-password" type="password" autoComplete="new-password" required minLength={14} maxLength={256} value={newPassword} onChange={event => setNewPassword(event.target.value)}/><small>14文字以上で、大文字・小文字・数字・記号を含めてください。</small></label><label className="admin-field"><span>新しいパスワード（確認）</span><input name="confirm-password" type="password" autoComplete="new-password" required minLength={14} maxLength={256} value={confirmation} onChange={event => setConfirmation(event.target.value)}/></label>{challenge.requiredAttributes.map(name => <label className="admin-field" key={name}><span>{({ email: "メールアドレス", name: "お名前", phone_number: "電話番号" } as Record<string,string>)[name] || name}</span><input required type={name === "email" ? "email" : "text"} value={attributes[name] || ""} onChange={event => setAttributes(current => ({ ...current, [name]: event.target.value }))}/></label>)}</>}
    </fieldset>{error && <p role="alert" className="admin-alert admin-alert-error">{error}</p>}<button className="admin-button admin-button-full" type="submit" disabled={loading}>{loading ? "確認しています…" : challenge ? "パスワードを設定してログイン" : "ログイン"}</button>
    {challenge && <button type="button" disabled={loading} className="admin-text-button" onClick={() => { session.clear(); setChallenge(null); setNewPassword(""); setConfirmation(""); setError(""); }}>ログイン画面に戻る</button>}
    </form><p className="admin-login-note">ログイン情報はブラウザに保存されません。再読み込みすると再ログインが必要です。</p></section>;
}

export function AdminPassword({ session, onDirty, onBusy }: { session: AdminSession; onDirty: (value: boolean) => void; onBusy: (value: boolean) => void }) {
  const [previous, setPrevious] = useState(""); const [next, setNext] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const busy = useRef(false);
  useEffect(() => { onDirty(Boolean(previous || next || confirmation)); return () => onDirty(false); }, [previous, next, confirmation, onDirty]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    if (next !== confirmation) { setError("新しいパスワードと確認用の入力が一致しません。"); return; }
    busy.current = true; setSaving(true); onBusy(true); setError(""); setNotice("");
    try { await session.changePassword(previous, next); setPrevious(""); setNext(""); setConfirmation(""); onDirty(false); setNotice("パスワードを変更しました。次回から新しいパスワードでログインできます。"); }
    catch (problem) { setError(messageOf(problem)); }
    finally { busy.current = false; setSaving(false); onBusy(false); }
  }
  return <section><div className="admin-section-heading"><div><span className="admin-kicker">ACCOUNT</span><h1>パスワードの変更</h1><p>現在ログインしているアカウントのパスワードを変更します。</p></div></div><form className="admin-password-card" onSubmit={submit}><fieldset className="admin-fieldset" disabled={saving}>
    <input className="admin-hidden-username" autoComplete="username" value={session.username} readOnly aria-label="ログインID"/>
    <label className="admin-field"><span>現在のパスワード</span><input type="password" autoComplete="current-password" required maxLength={256} value={previous} onChange={event => setPrevious(event.target.value)}/></label>
    <label className="admin-field"><span>新しいパスワード</span><input type="password" autoComplete="new-password" required minLength={14} maxLength={256} value={next} onChange={event => setNext(event.target.value)}/><small>14文字以上で、大文字・小文字・数字・記号を含めてください。</small></label>
    <label className="admin-field"><span>新しいパスワード（確認）</span><input type="password" autoComplete="new-password" required minLength={14} maxLength={256} value={confirmation} onChange={event => setConfirmation(event.target.value)}/></label>
    </fieldset>{error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}{notice && <p className="admin-alert admin-alert-success" role="status">{notice}</p>}<button className="admin-button" type="submit" disabled={saving}>{saving ? "変更しています…" : "パスワードを変更"}</button></form></section>;
}
