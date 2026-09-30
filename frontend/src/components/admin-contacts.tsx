"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { messageOf, type AdminApi, type ContactRecord, type ContactStatus } from "@/lib/admin-api";

const statusLabels: Record<ContactStatus, string> = { new: "未読", read: "既読", archived: "アーカイブ" };
export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(date);
}

export function AdminContacts({ api, enabled, onBusy }: { api: AdminApi; enabled: boolean; onBusy: (value: boolean) => void }) {
  const [items, setItems] = useState<ContactRecord[]>([]);
  const [selected, setSelected] = useState<ContactRecord | null>(null);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestNumber = useRef(0);
  const busy = useRef(false);
  const cursor = cursors[page];
  const load = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true); setError("");
    try {
      const result = await api.contacts(cursor);
      if (request !== requestNumber.current) return;
      setItems(result.items); setNextCursor(result.nextCursor);
      setSelected(current => current ? result.items.find(item => item.id === current.id) || null : null);
    } catch (problem) { if (request === requestNumber.current) setError(messageOf(problem)); }
    finally { if (request === requestNumber.current) setLoading(false); }
  }, [api, cursor]);
  useEffect(() => { if (enabled) void load(); return () => { requestNumber.current += 1; }; }, [enabled, load]);

  async function changeStatus(nextStatus: ContactStatus) {
    if (!selected || busy.current) return;
    busy.current = true; setSaving(true); onBusy(true); setError(""); setNotice("");
    try {
      const updated = await api.contactStatus(selected, nextStatus);
      setSelected(updated); setItems(current => current.map(item => item.id === updated.id ? updated : item));
      setNotice(`${statusLabels[nextStatus]}に変更しました。`);
    } catch (problem) { setError(messageOf(problem)); }
    finally { busy.current = false; setSaving(false); onBusy(false); }
  }
  const shown = items.filter(item => !status || item.status === status);
  return <section>
    <div className="admin-section-heading"><div><span className="admin-kicker">INBOX</span><h1>お問い合わせ</h1><p>届いたご相談を確認し、対応状況を整理できます。</p></div><button type="button" className="admin-button admin-secondary" disabled={loading || saving} onClick={load}>再読み込み</button></div>
    {error && <div className="admin-alert admin-alert-error" role="alert"><p>{error}</p><button type="button" className="admin-text-button" disabled={loading || saving} onClick={load}>最新の状態を読み直す</button></div>}
    {notice && <p className="admin-alert admin-alert-success" role="status">{notice}</p>}
    <div className="admin-inbox-layout"><div className="admin-list-panel">
      <label className="admin-field admin-inbox-filter"><span>このページの表示</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">すべて</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {loading ? <p className="admin-empty" role="status">読み込んでいます…</p> : !shown.length && <p className="admin-empty">表示するお問い合わせがありません。</p>}
      <ul className="admin-record-list">{shown.map(item => <li key={item.id} className={selected?.id === item.id ? "is-selected" : ""}><button type="button" className="admin-record-select" disabled={saving || loading} aria-pressed={selected?.id === item.id} onClick={() => { setSelected(item); setNotice(""); }}><span className="admin-record-meta"><span className={`admin-badge ${item.status !== "new" ? "is-muted" : ""}`}>{statusLabels[item.status]}</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span><strong>{item.name}</strong><span>{item.type}</span><span className="admin-contact-excerpt">{item.message}</span></button></li>)}</ul>
      <nav className="admin-pagination" aria-label="お問い合わせのページ"><button type="button" className="admin-button admin-secondary" disabled={page === 0 || loading || saving} onClick={() => { setSelected(null); setPage(value => value - 1); }}>前へ</button><span>{page + 1} ページ</span><button type="button" className="admin-button admin-secondary" disabled={!nextCursor || loading || saving} onClick={() => { if (nextCursor) { setCursors(current => [...current.slice(0, page + 1), nextCursor]); setSelected(null); setPage(value => value + 1); } }}>次へ</button></nav>
    </div>
    {selected ? <article className="admin-contact-detail"><header><span className="admin-kicker">CONTACT DETAILS</span><h2>{selected.name} 様</h2><time dateTime={selected.createdAt}>{formatDate(selected.createdAt)}</time></header>
      <dl><div><dt>会社名 / 屋号</dt><dd>{selected.company || "記載なし"}</dd></div><div><dt>メールアドレス</dt><dd>{selected.email}</dd></div><div><dt>ご相談の種類</dt><dd>{selected.type}</dd></div><div><dt>対応状況</dt><dd>{statusLabels[selected.status]}</dd></div></dl>
      <section className="admin-contact-message"><h3>ご相談内容</h3><p>{selected.message}</p></section>
      <div className="admin-contact-actions">{(["new", "read", "archived"] as ContactStatus[]).filter(value => value !== selected.status).map(value => <button type="button" className={`admin-button ${value === "read" ? "" : "admin-secondary"}`} disabled={saving || loading} key={value} onClick={() => changeStatus(value)}>{value === "archived" ? "アーカイブする" : `${statusLabels[value]}にする`}</button>)}</div>
    </article> : <div className="admin-editor-placeholder"><span aria-hidden="true">↖</span><h2>お問い合わせを選択</h2><p>本文とご連絡先を確認できます。</p></div>}
    </div>
  </section>;
}
