"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { messageOf, type AdminApi, type Collection, type ContentRecord } from "@/lib/admin-api";
import { collectionLabels, contentTitle, text } from "@/lib/admin-content";
import { AdminEditor } from "./admin-editor";

interface Props {
  collection: Collection; api: AdminApi; enabled: boolean; canLeave: () => boolean;
  onDirty: (value: boolean) => void; onBusy: (value: boolean) => void;
}

export function AdminContentPanel({ collection, api, enabled, canLeave, onDirty, onBusy }: Props) {
  const [items, setItems] = useState<ContentRecord[]>([]);
  const [selected, setSelected] = useState<ContentRecord | "new" | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const activeRequest = useRef(0);
  const mutation = useRef(false);

  const load = useCallback(async () => {
    const request = ++activeRequest.current;
    setLoading(true); setError("");
    try {
      const loaded = await api.list(collection);
      if (request === activeRequest.current) { setItems(loaded); return loaded; }
    } catch (problem) { if (request === activeRequest.current) setError(messageOf(problem)); }
    finally { if (request === activeRequest.current) setLoading(false); }
    return null;
  }, [api, collection]);

  useEffect(() => {
    if (enabled) void load();
    return () => { activeRequest.current += 1; };
  }, [enabled, load]);

  async function reload() {
    if (!canLeave() || pending) return;
    const currentId = selected && selected !== "new" ? selected.id : null;
    const loaded = await load();
    if (loaded) {
      setSelected(currentId ? loaded.find(item => item.id === currentId) || null : null);
      setEditorKey(key => key + 1); onDirty(false);
    }
  }
  function select(item: ContentRecord | "new" | null) {
    if (pending || !canLeave()) return;
    setSelected(item); setEditorKey(key => key + 1); setNotice(""); onDirty(false);
  }
  async function remove(item: ContentRecord) {
    if (mutation.current || pending || !canLeave()) return;
    if (!window.confirm(`「${contentTitle(item.data)}」を削除します。この操作は取り消せません。`)) return;
    mutation.current = true; setPending(true); onBusy(true); setError("");
    try {
      await api.remove(collection, item);
      setItems(current => current.filter(row => row.id !== item.id));
      if (selected && selected !== "new" && selected.id === item.id) { setSelected(null); onDirty(false); }
      setNotice("削除しました。");
    } catch (problem) { setError(messageOf(problem)); }
    finally { mutation.current = false; setPending(false); onBusy(false); }
  }
  function editorBusy(value: boolean) { setPending(value); onBusy(value); }
  const categories = Array.from(new Set(items.map(item => text(item.data.category)).filter(Boolean)));
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja");
  const visible = items.filter(item => (!category || item.data.category === category) &&
    normalize(`${contentTitle(item.data)} ${text(item.data.category)} ${item.id}`).includes(normalize(query)));

  return <section className="admin-content-panel" aria-label={collectionLabels[collection]}>
    <div className="admin-section-heading"><div><span className="admin-kicker">CONTENTS</span><h1>{collectionLabels[collection]}</h1><p>公開サイトに表示する内容を管理します。</p></div><button type="button" className="admin-button" disabled={loading || pending || !enabled} onClick={() => select("new")}>＋ 新しく登録</button></div>
    {error && <div className="admin-alert admin-alert-error" role="alert"><p>{error}</p><button type="button" className="admin-text-button" onClick={reload} disabled={pending || loading}>一覧を読み直す</button></div>}
    {notice && <p className="admin-alert admin-alert-success" role="status">{notice}</p>}
    <div className="admin-content-layout">
      <div className="admin-list-panel">
        <div className="admin-list-tools"><label className="admin-field"><span>一覧を検索</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="タイトル・カテゴリ"/></label>
          {categories.length > 0 && <label className="admin-field"><span>カテゴリ</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">すべて</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
          <div className="admin-list-summary"><span>{visible.length} / {items.length} 件</span><button type="button" className="admin-text-button" onClick={reload} disabled={pending || loading}>再読み込み</button></div>
        </div>
        {loading && <p className="admin-empty" role="status">読み込んでいます…</p>}
        {!loading && !visible.length && <p className="admin-empty">{items.length ? "条件に合う項目がありません。" : "まだ登録がありません。"}</p>}
        <ul className="admin-record-list">{visible.map(item => <li key={item.id} className={selected !== "new" && selected?.id === item.id ? "is-selected" : ""}>
          <button type="button" className="admin-record-select" disabled={pending || loading} onClick={() => select(item)} aria-pressed={selected !== "new" && selected?.id === item.id}>
            <span className="admin-record-meta"><span className={`admin-badge ${item.data.published === false ? "is-muted" : ""}`}>{item.data.published === false ? "非公開" : "公開中"}</span><span>表示順 {item.data.order || 0}</span></span>
            <strong>{contentTitle(item.data)}</strong><span className="admin-record-id">{item.id}</span>
          </button><button type="button" className="admin-delete-button" disabled={pending || loading} onClick={() => remove(item)} aria-label={`${contentTitle(item.data)}を削除`}>削除</button>
        </li>)}</ul>
      </div>
      {selected ? <AdminEditor key={`${collection}-${editorKey}`} collection={collection} record={selected === "new" ? null : selected} api={api}
        onClose={() => select(null)} onReload={reload} onDirty={onDirty} onBusy={editorBusy}
        onSaved={saved => { setItems(current => [...current.filter(item => item.id !== saved.id), saved].sort((a, b) => a.data.order - b.data.order)); setSelected(saved); setNotice("保存しました。"); }}/>
        : <div className="admin-editor-placeholder"><span aria-hidden="true">↖</span><h2>編集する項目を選択</h2><p>新しい内容は「新しく登録」から追加できます。</p></div>}
    </div>
  </section>;
}
