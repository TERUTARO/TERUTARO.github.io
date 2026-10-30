"use client";

import { useCallback, useEffect, useState } from "react";
import profile from "../../content/profile.json";
import { messageOf, type AdminApi, type ContentRecord } from "@/lib/admin-api";
import { createSkillSheet, skillSheetFilename, skillSheetSummary, type SkillSheetSummary } from "@/lib/skill-sheet";

interface Props { api: AdminApi; enabled: boolean; onBusy: (busy: boolean) => void }
interface SourceData { skills: ContentRecord[]; projects: ContentRecord[] }

export function AdminSkillSheet({ api, enabled, onBusy }: Props) {
  const [summary, setSummary] = useState<SkillSheetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (): Promise<SourceData> => {
    const [skills, projects] = await Promise.all([api.list("skills"), api.list("projects")]);
    setSummary(skillSheetSummary(skills, projects));
    return { skills, projects };
  }, [api]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true); setError("");
    load().catch(cause => { if (!cancelled) setError(messageOf(cause)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, load]);

  async function download() {
    setLoading(true); setError(""); setNotice(""); onBusy(true);
    try {
      const source = await load();
      const generatedAt = new Date();
      const blob = await createSkillSheet(profile, source.skills, source.projects, generatedAt);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = skillSheetFilename(generatedAt);
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSummary(skillSheetSummary(source.skills, source.projects, generatedAt));
      setNotice("最新データからスキルシートを作成しました。");
    } catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); onBusy(false); }
  }

  return <section aria-labelledby="skill-sheet-heading">
    <div className="admin-section-heading"><div><span className="admin-kicker">EXPORT</span><h1 id="skill-sheet-heading">スキルシート</h1><p>公開中のスキルと実績を、職務経歴を含むPDFにまとめます。</p></div></div>
    <div className="admin-skill-sheet-card">
      <div className="admin-skill-sheet-mark" aria-hidden="true">PDF</div>
      <div><h2>最新のスキルシートをダウンロード</h2><p>ダウンロード直前に管理APIを読み直すため、保存済みの最新内容が反映されます。</p></div>
      {summary && <dl className="admin-skill-sheet-summary">
        <div><dt>スキルカテゴリ</dt><dd>{summary.skillCategories}件</dd></div><div><dt>実績・経歴</dt><dd>{summary.projects}件</dd></div><div><dt>確認日時</dt><dd>{summary.generatedAt.toLocaleString("ja-JP")}</dd></div>
      </dl>}
      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {notice && <p className="admin-alert admin-alert-success" role="status">{notice}</p>}
      <div className="admin-skill-sheet-actions"><button type="button" className="admin-button" disabled={loading || !enabled} onClick={download}>{loading ? "最新データを確認中…" : "PDFをダウンロード"}</button><p>公開中の項目だけを使用し、ファイルはこのブラウザ内で生成します。日本語フォントはM PLUS 1p（SIL OFL 1.1）を使用しています。</p></div>
    </div>
  </section>;
}
