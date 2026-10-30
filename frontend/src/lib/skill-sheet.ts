import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import type { ContentRecord } from "./admin-api";
import { rows, strings, text } from "./admin-content";

export interface SkillSheetProfile { name: string; birthday: string }
export interface SkillSheetSummary { skillCategories: number; projects: number; generatedAt: Date }

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_URL = "/assets/skill-sheet/MPLUS1p-Regular.ttf";
const GREEN = rgb(46 / 255, 81 / 255, 68 / 255);
const TEXT = rgb(38 / 255, 55 / 255, 47 / 255);
const MUTED = rgb(102 / 255, 117 / 255, 109 / 255);
const PALE_GREEN = rgb(234 / 255, 240 / 255, 235 / 255);
const LINE = rgb(220 / 255, 227 / 255, 222 / 255);
const WHITE = rgb(1, 1, 1);

let fontBytesPromise: Promise<ArrayBuffer> | null = null;

function loadFont(): Promise<ArrayBuffer> {
  fontBytesPromise ??= fetch(FONT_URL, { cache: "force-cache", credentials: "same-origin" }).then(response => {
    if (!response.ok) throw new Error("PDF用の日本語フォントを読み込めませんでした。再読み込みしてお試しください。");
    return response.arrayBuffer();
  });
  return fontBytesPromise;
}

function published(records: ContentRecord[]): ContentRecord[] {
  return records.filter(record => record.data.published !== false);
}

function projectOrder(a: ContentRecord, b: ContentRecord): number {
  const current = Number(Boolean(b.data.current)) - Number(Boolean(a.data.current));
  if (current) return current;
  const year = Number(text(b.data.year)) - Number(text(a.data.year));
  if (year) return year;
  return Number(a.data.order || 0) - Number(b.data.order || 0);
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const sourceLine of (value || "—").split("\n")) {
    let line = "";
    for (const character of Array.from(sourceLine)) {
      const candidate = line + character;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line.trimEnd());
        line = character.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line || " ");
  }
  return lines;
}

export function skillSheetSummary(skills: ContentRecord[], projects: ContentRecord[], generatedAt = new Date()): SkillSheetSummary {
  return { skillCategories: published(skills).length, projects: published(projects).length, generatedAt };
}

export async function createSkillSheet(profile: SkillSheetProfile, skillRecords: ContentRecord[], projectRecords: ContentRecord[], generatedAt = new Date()): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Full embedding avoids incomplete CJK glyph maps in PDF viewers.
  const font = await pdf.embedFont(await loadFont(), { subset: false });
  pdf.setTitle("照屋 朝太郎 スキルシート");
  pdf.setAuthor("terutaro");
  pdf.setSubject("スキルシート / 職務経歴");
  pdf.setCreator("terutaro admin");
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: WHITE });
  const pages: PDFPage[] = [page];
  let y = PAGE_HEIGHT - MARGIN;
  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: WHITE });
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensure = (height: number) => { if (y - height < MARGIN + 20) addPage(); };
  const drawLines = (value: string, options: { x?: number; width?: number; size?: number; lineHeight?: number; color?: ReturnType<typeof rgb>; before?: number; after?: number } = {}) => {
    const x = options.x ?? MARGIN;
    const size = options.size ?? 9.5;
    const lineHeight = options.lineHeight ?? size * 1.65;
    const lines = wrapText(value, font, size, options.width ?? CONTENT_WIDTH);
    y -= options.before ?? 0;
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x, y: y - size, size, font, color: options.color ?? TEXT });
      y -= lineHeight;
    }
    y -= options.after ?? 0;
  };
  const drawSection = (title: string) => {
    ensure(42);
    y -= 16;
    page.drawText(title, { x: MARGIN, y: y - 15, size: 15, font, color: GREEN });
    y -= 25;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.4, color: GREEN });
    y -= 12;
  };
  const drawDetail = (label: string, value: string) => {
    const labelWidth = 76;
    const size = 8.8;
    const lineHeight = 14.4;
    const lines = wrapText(value || "—", font, size, CONTENT_WIDTH - labelWidth);
    ensure(Math.min(44, lines.length * lineHeight));
    page.drawText(label, { x: MARGIN, y: y - size, size, font, color: GREEN });
    for (const [index, line] of lines.entries()) {
      if (index > 0) ensure(lineHeight);
      page.drawText(line, { x: MARGIN + labelWidth, y: y - size, size, font, color: TEXT });
      y -= lineHeight;
    }
    y -= 2;
  };

  page.drawText("SKILL SHEET", { x: MARGIN, y: y - 26, size: 25, font, color: GREEN });
  y -= 36;
  drawLines("スキルシート / 職務経歴", { size: 10.5, color: MUTED, after: 22 });
  const generatedLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(generatedAt);
  const info = [["氏名", profile.name], ["生年月日", profile.birthday], ["作成日時", `${generatedLabel} JST`]];
  for (const [label, value] of info) {
    ensure(30);
    page.drawRectangle({ x: MARGIN, y: y - 25, width: 110, height: 25, color: PALE_GREEN });
    page.drawRectangle({ x: MARGIN + 110, y: y - 25, width: CONTENT_WIDTH - 110, height: 25, borderColor: LINE, borderWidth: .5 });
    page.drawText(label, { x: MARGIN + 9, y: y - 16, size: 8.5, font, color: GREEN });
    page.drawText(value || "—", { x: MARGIN + 120, y: y - 16, size: 8.5, font, color: TEXT });
    y -= 25;
  }

  drawSection("スキル");
  for (const record of published(skillRecords)) {
    const data = record.data;
    ensure(32);
    drawLines(text(data.heading) || text(data.label) || record.id, { size: 11.5, color: GREEN, before: 5, after: 4 });
    for (const group of rows(data.groups)) {
      const items = strings(group.items);
      if (items.length) drawDetail(text(group.name) || "Stack", items.join(" / "));
    }
  }

  drawSection("実績・職務経歴");
  for (const record of published(projectRecords).sort(projectOrder)) {
    const data = record.data;
    ensure(105);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: .55, color: LINE });
    drawLines(`${text(data.title) || record.id}${data.current ? "  /  CURRENT" : ""}`, { size: 11.5, color: GREEN, before: 9, after: 5 });
    drawDetail("期間", text(data.period) || text(data.year));
    drawDetail("案件・会社", text(data.client));
    drawDetail("概要", text(data.summary));
    drawDetail("担当", text(data.role));
    const phases = strings(data.phases);
    if (phases.length) drawDetail("担当フェーズ", phases.join(" / "));
    const stackLines = rows(data.stackGroups).map(group => {
      const values = strings(group.tags);
      return values.length ? `${text(group.label) || "Stack"}: ${values.join(" / ")}` : "";
    }).filter(Boolean);
    if (stackLines.length) drawDetail("技術スタック", stackLines.join("\n"));
    y -= 5;
  }

  for (const [index, target] of pages.entries()) {
    const pageLabel = `terutaro  /  ${index + 1}`;
    target.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(pageLabel, 7.5), y: 24, size: 7.5, font, color: MUTED });
  }
  const bytes = await pdf.save();
  return new Blob([bytes.slice().buffer], { type: "application/pdf" });
}

export function skillSheetFilename(generatedAt = new Date()): string {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(generatedAt);
  return `terutaro-skill-sheet-${date}.pdf`;
}
