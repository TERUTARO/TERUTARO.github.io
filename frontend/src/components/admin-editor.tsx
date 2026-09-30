"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AdminError, messageOf, type AdminApi, type Collection, type ContentData, type ContentRecord } from "@/lib/admin-api";
import { categoryOptions, fields, newContent, prepareContent, rows, splitLines, strings, text, validateContent } from "@/lib/admin-content";

interface Props {
  collection: Collection; record: ContentRecord | null; api: AdminApi;
  onSaved: (record: ContentRecord) => void; onClose: () => void; onReload: () => void;
  onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void;
}

export function AdminEditor({ collection, record, api, onSaved, onClose, onReload, onDirty, onBusy }: Props) {
  const prefix = useId();
  const [draft, setDraft] = useState<ContentData>(() => structuredClone(record?.data || newContent(collection)));
  const baseline = useRef(JSON.stringify(draft));
  const [version, setVersion] = useState(record?.version ?? null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const dirty = baseline.current !== JSON.stringify(draft);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const update = (key: string, value: unknown) => { setDraft(current => ({ ...current, [key]: value })); setNotice(""); };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const validation = validateContent(collection, draft);
    if (validation) { setError(validation); return; }
    busy.current = true; setSaving(true); onBusy(true); setError(""); setNotice(""); setConflict(false);
    try {
      const saved = await api.save(collection, draft.id, prepareContent(collection, draft), version);
      baseline.current = JSON.stringify(saved.data); setDraft(saved.data); setVersion(saved.version); onDirty(false);
      setNotice("保存しました。"); onSaved(saved);
    } catch (problem) { setError(messageOf(problem)); setConflict(problem instanceof AdminError && problem.status === 409); }
    finally { busy.current = false; setSaving(false); onBusy(false); }
  }

  const repeatKey = collection === "skills" ? "groups" : "stackGroups";
  const groupName = collection === "skills" ? "name" : "label";
  const groupItems = collection === "skills" ? "items" : "tags";
  const groups = rows(draft[repeatKey]);
  function updateGroup(index: number, key: string, value: unknown) {
    update(repeatKey, groups.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }
  const sites = rows(draft.sites);
  function updateSite(index: number, key: string, value: string) {
    update("sites", sites.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  return <section className="admin-editor" aria-labelledby={`${prefix}-heading`}>
    <div className="admin-editor-heading"><div><span className="admin-kicker">{version === null ? "NEW CONTENT" : "EDIT CONTENT"}</span><h2 id={`${prefix}-heading`}>{version === null ? "新しく登録する" : "内容を編集する"}</h2></div><button type="button" className="admin-text-button" disabled={saving} onClick={onClose}>閉じる</button></div>
    <form onSubmit={save}>
      <fieldset disabled={saving} className="admin-fieldset">
        <div className="admin-editor-meta">
          <label className="admin-field"><span>管理ID <small>必須</small></span><input value={draft.id} onChange={event => update("id", event.target.value)} required maxLength={80} pattern="[a-z0-9][a-z0-9_-]*" readOnly={version !== null}/><small>{version === null ? "自動生成済み。必要に応じて半角小文字の英数字で変更できます。" : "登録後の管理IDは変更できません。"}</small></label>
          <label className="admin-field"><span>表示順 <small>必須</small></span><input type="number" min={-1000000} max={1000000} step="1" required value={draft.order} onChange={event => update("order", event.target.value === "" ? "" : Number(event.target.value))}/><small>小さい数字から表示します。</small></label>
          <label className="admin-check"><input type="checkbox" checked={draft.published !== false} onChange={event => update("published", event.target.checked)}/><span>公開する</span></label>
        </div>
        <div className="admin-fields">
          {fields[collection].map(field => {
            const id = `${prefix}-${field.key}`;
            if (field.kind === "boolean") return <label className="admin-check" key={field.key}><input type="checkbox" checked={draft[field.key] === true} onChange={event => update(field.key, event.target.checked)}/><span>{field.label}</span></label>;
            return <label className={`admin-field ${field.kind === "textarea" || field.kind === "lines" ? "admin-field-wide" : ""}`} key={field.key} htmlFor={id}>
              <span>{field.label} {field.required && <small>必須</small>}</span>
              {field.kind === "select" ? <select id={id} value={text(draft[field.key])} onChange={event => update(field.key, event.target.value)}>{field.options?.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select> :
                field.kind === "lines" ? <LinesInput id={id} value={strings(draft[field.key])} onChange={value => update(field.key, value)}/> :
                field.kind === "textarea" ? <textarea id={id} rows={4} required={field.required} maxLength={field.maxLength || 3000} value={text(draft[field.key])} onChange={event => update(field.key, event.target.value)}/> :
                <input id={id} required={field.required} maxLength={field.maxLength || 200} value={text(draft[field.key])} onChange={event => update(field.key, event.target.value)}/>}
              {(field.hint || field.kind === "lines") && <small>{field.hint || "1行に1つ入力してください。"}</small>}
            </label>;
          })}
        </div>
        {collection === "projects" && <fieldset className="admin-choice-group"><legend>追加カテゴリ（任意）</legend>{categoryOptions.map(option => <label className="admin-check" key={option.value}><input type="checkbox" checked={strings(draft.categories).includes(option.value)} onChange={event => update("categories", event.target.checked ? [...strings(draft.categories), option.value] : strings(draft.categories).filter(value => value !== option.value))}/><span>{option.label}</span></label>)}</fieldset>}
        {(collection === "projects" || collection === "skills") && <section className="admin-repeat-section" aria-label={collection === "skills" ? "スキルグループ" : "技術スタック"}>
          <h3>{collection === "skills" ? "スキルグループ" : "技術スタック"}</h3><p>分類ごとにグループを追加できます。</p>
          {groups.map((group, index) => <div className="admin-repeat-row" key={index}>
            <div className="admin-repeat-heading"><strong>グループ {index + 1}</strong><button type="button" className="admin-text-button admin-danger-text" onClick={() => update(repeatKey, groups.filter((_, i) => i !== index))}>このグループを除く</button></div>
            <label className="admin-field"><span>グループ名 {collection !== "skills" && <small>必須</small>}</span><input required={collection !== "skills"} maxLength={100} value={text(group[groupName])} onChange={event => updateGroup(index, groupName, event.target.value)} placeholder={collection === "skills" ? "例：AWS" : "例：Infrastructure"}/></label>
            <label className="admin-field"><span>項目（1行に1つ）</span><LinesInput value={strings(group[groupItems])} onChange={value => updateGroup(index, groupItems, value)}/></label>
          </div>)}
          <button type="button" className="admin-button admin-secondary" disabled={groups.length >= 20} onClick={() => update(repeatKey, [...groups, { [groupName]: "", [groupItems]: [] }])}>＋ グループを追加</button>
        </section>}
        {collection === "partners" && <section className="admin-repeat-section" aria-label="Webサイト"><h3>Webサイト</h3><p>関連するサイトを追加できます。</p>
          {sites.map((site, index) => <div className="admin-repeat-row" key={index}><div className="admin-repeat-heading"><strong>サイト {index + 1}</strong><button type="button" className="admin-text-button admin-danger-text" onClick={() => update("sites", sites.filter((_, i) => i !== index))}>このサイトを除く</button></div>
            <label className="admin-field"><span>サイト名 <small>必須</small></span><input required maxLength={200} value={text(site.label)} onChange={event => updateSite(index, "label", event.target.value)}/></label>
            <label className="admin-field"><span>URL <small>必須</small></span><input type="url" required maxLength={2048} value={text(site.url)} onChange={event => updateSite(index, "url", event.target.value)} placeholder="https://example.com/"/></label>
            <label className="admin-field"><span>既存プレビュー画像のキー（任意）</span><input maxLength={80} value={text(site.previewKey)} onChange={event => updateSite(index, "previewKey", event.target.value)}/><small>登録済み画像を使う場合のみ指定してください。</small></label>
          </div>)}<button type="button" className="admin-button admin-secondary" disabled={sites.length >= 10} onClick={() => update("sites", [...sites, { label: "", url: "" }])}>＋ サイトを追加</button>
        </section>}
        {["services", "engineers", "advisory"].includes(collection) && <fieldset className="admin-price-fields"><legend>金額（税抜）</legend>
          <label className="admin-check"><input type="checkbox" checked={draft.priceYen === null} onChange={event => update("priceYen", event.target.checked ? null : 0)}/><span>都度お見積もり</span></label>
          <label className="admin-field"><span>金額（円）</span><input type="number" inputMode="numeric" min="0" max="1000000000" step="1" disabled={draft.priceYen === null} required={draft.priceYen !== null} value={draft.priceYen === null ? "" : String(draft.priceYen ?? "")} onChange={event => update("priceYen", event.target.value === "" ? "" : Number(event.target.value))}/></label>
        </fieldset>}
      </fieldset>
      {error && <div className="admin-alert admin-alert-error" role="alert"><p>{error}</p>{conflict && <button type="button" className="admin-button admin-secondary" onClick={onReload}>最新データを読み直す</button>}</div>}
      {notice && <p className="admin-alert admin-alert-success" role="status">{notice}</p>}
      <div className="admin-save-bar"><span>{saving ? "保存しています…" : dirty ? "未保存の変更があります" : version === null ? "内容を入力して登録してください" : "変更は保存されています"}</span><button className="admin-button" type="submit" disabled={saving || conflict}>{saving ? "保存中…" : "保存する"}</button></div>
    </form>
  </section>;
}

// Keep the raw text locally while editing so entering a new line never removes
// the caret's blank line. The persisted representation remains an array.
function LinesInput({ value, onChange, id }: { value: string[]; onChange: (value: string[]) => void; id?: string }) {
  const [raw, setRaw] = useState(value.join("\n"));
  useEffect(() => {
    if (JSON.stringify(splitLines(raw)) !== JSON.stringify(value)) setRaw(value.join("\n"));
  }, [value, raw]);
  return <textarea id={id} rows={4} value={raw} onChange={event => { setRaw(event.target.value); onChange(splitLines(event.target.value)); }} />;
}
