import { object, type Collection, type ContentData } from "./admin-api";

export const collectionLabels: Record<Collection, string> = {
  projects: "実績", skills: "スキル", partners: "長期パートナー",
  services: "サービス単価", engineers: "時間単価", advisory: "顧問単価",
};
export interface FieldDefinition {
  key: string; label: string; kind?: "textarea" | "lines" | "select" | "boolean";
  required?: boolean; maxLength?: number; hint?: string; options?: { value: string; label: string }[];
}
export const categoryOptions = [
  { value: "infrastructure", label: "インフラ" }, { value: "development", label: "開発" }, { value: "network", label: "ネットワーク" },
];
export const fields: Record<Collection, FieldDefinition[]> = {
  projects: [
    { key: "title", label: "実績タイトル", required: true }, { key: "client", label: "会社・案件名", required: true },
    { key: "year", label: "開始年", required: true, maxLength: 4, hint: "例：2026" },
    { key: "period", label: "期間", required: true, hint: "例：2025.09 — 現在" },
    { key: "category", label: "主なカテゴリ", kind: "select", options: categoryOptions },
    { key: "summary", label: "概要", kind: "textarea", required: true },
    { key: "role", label: "担当内容", kind: "textarea", required: true, maxLength: 200 },
    { key: "tags", label: "検索タグ", kind: "lines", hint: "技術・キーワードを1行に1つ入力" },
    { key: "phases", label: "担当フェーズ", kind: "lines", hint: "例：要件定義、設計、構築をそれぞれ別の行に入力" },
    { key: "current", label: "現在進行中の実績", kind: "boolean" },
    { key: "partner", label: "長期パートナー名" },
    { key: "partnerHonorific", label: "パートナー名の敬称", hint: "例：様（敬称なしは空欄）" },
  ],
  skills: [
    { key: "label", label: "タブ名", required: true, hint: "例：Cloud & Infrastructure" },
    { key: "heading", label: "見出し", required: true },
    { key: "icon", label: "アイコン", kind: "select", options: [
      { value: "cloud", label: "クラウド" }, { value: "development", label: "開発" },
      { value: "ai", label: "AI" }, { value: "devops", label: "ネットワーク" },
    ] },
  ],
  partners: [
    { key: "name", label: "会社・団体名", required: true },
    { key: "summary", label: "取り組みの紹介", kind: "textarea", required: true },
    { key: "tags", label: "タグ", kind: "lines" },
  ],
  services: [
    { key: "category", label: "カテゴリ", required: true, hint: "例：パブリッククラウド" },
    { key: "product", label: "製品・サービス", hint: "例：AWS ECS" },
    { key: "item", label: "作業内容", required: true }, { key: "unit", label: "単位", hint: "例：1サーバにつき" },
    { key: "invoiceUnit", label: "請求書記載単位（任意）" }, { key: "notes", label: "備考・条件", kind: "textarea" },
  ],
  engineers: [
    { key: "category", label: "エンジニアの区分", required: true },
    { key: "phase", label: "フェーズ", required: true }, { key: "unit", label: "単位" },
    { key: "notes", label: "備考・条件", kind: "textarea" },
  ],
  advisory: [
    { key: "title", label: "顧問プラン名", required: true },
    { key: "summary", label: "プランの紹介", kind: "textarea", required: true },
    { key: "unit", label: "単位", hint: "例：月額" },
  ],
};

export const text = (value: unknown) => typeof value === "string" ? value : "";
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
export const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(object) : [];
export const splitLines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

export function newContent(collection: Collection): ContentData {
  const common = { id: `${collection}-${crypto.randomUUID()}`, order: 0, published: true };
  const defaults: Record<Collection, Record<string, unknown>> = {
    projects: { title: "", client: "", year: String(new Date().getFullYear()), period: "", category: "infrastructure", categories: [], summary: "", role: "", tags: [], phases: [], stackGroups: [], current: false, partner: "", partnerHonorific: "様" },
    skills: { label: "", heading: "", icon: "cloud", groups: [] },
    partners: { name: "", summary: "", tags: [], sites: [] },
    services: { category: "", product: "", item: "", unit: "", invoiceUnit: "", notes: "", priceYen: null },
    engineers: { category: "", phase: "", unit: "円／時間", notes: "", priceYen: null },
    advisory: { title: "顧問", summary: "", unit: "月額", priceYen: null },
  };
  return { ...common, ...defaults[collection] };
}

export function contentTitle(data: ContentData): string {
  return text(data.title) || text(data.name) || text(data.heading) ||
    [text(data.product), text(data.item)].filter(Boolean).join(" / ") ||
    [text(data.category), text(data.phase)].filter(Boolean).join(" / ") || data.id;
}

export function validateContent(collection: Collection, data: ContentData): string | null {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(data.id)) return "管理IDは半角小文字の英数字で始め、英数字・ハイフン・アンダースコアで80文字以内にしてください。";
  if (!Number.isInteger(data.order) || Math.abs(data.order) > 1000000) return "表示順は-1,000,000〜1,000,000の整数にしてください。";
  for (const field of fields[collection]) {
    const value = text(data[field.key]);
    if (field.required && !value.trim()) return `${field.label}を入力してください。`;
    if (field.kind !== "lines" && value.length > (field.maxLength || (field.kind === "textarea" ? 3000 : 200))) return `${field.label}が長すぎます。`;
    if (field.kind === "lines" && (strings(data[field.key]).length > 60 || strings(data[field.key]).some(item => item.length > 100))) return `${field.label}は60項目まで、各100文字以内にしてください。`;
  }
  if (collection === "projects" && !/^(19|20|21)\d{2}$/.test(text(data.year))) return "開始年は1900〜2199年の西暦4桁で入力してください。";
  if (["services", "engineers", "advisory"].includes(collection) && data.priceYen !== null &&
      (!Number.isInteger(data.priceYen) || Number(data.priceYen) < 0 || Number(data.priceYen) > 1000000000)) return "金額は0〜1,000,000,000円の整数、または都度お見積もりを選択してください。";
  const grouped = rows(data[collection === "skills" ? "groups" : "stackGroups"]);
  if (grouped.length > 20) return "グループは20件まで登録できます。";
  for (const row of grouped) {
    const name = text(row[collection === "skills" ? "name" : "label"]);
    if (collection !== "skills" && !name.trim()) return "グループ名を入力してください。";
    if (name.length > 100) return "グループ名は100文字以内にしてください。";
    const items = strings(row[collection === "skills" ? "items" : "tags"]);
    if (items.length > 60 || items.some(item => item.length > 100)) return "グループ内の項目は60件まで、各100文字以内にしてください。";
  }
  if (rows(data.sites).length > 10) return "Webサイトは10件まで登録できます。";
  for (const site of rows(data.sites)) {
    if (!text(site.label).trim()) return "Webサイト名を入力してください。";
    try {
      const url = new URL(text(site.url));
      if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048 || /\s/.test(text(site.url))) return "WebサイトのURLはhttps://から始まるURLを入力してください。";
    } catch { return "WebサイトのURLを確認してください。"; }
    if (text(site.previewKey) && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(text(site.previewKey))) return "プレビュー画像のキーは、半角小文字の英数字で始まる80文字以内の識別子を入力してください。";
  }
  return null;
}

/** Keep provenance and unknown retrieved fields; omit empty optional identifiers. */
export function prepareContent(collection: Collection, data: ContentData): ContentData {
  const prepared = structuredClone(data);
  if (collection === "projects" && !text(prepared.partner).trim()) delete prepared.partner;
  if (collection === "partners") prepared.sites = rows(prepared.sites).map(site => {
    const copy = { ...site };
    if (!text(copy.previewKey).trim()) delete copy.previewKey;
    return copy;
  });
  return prepared;
}
