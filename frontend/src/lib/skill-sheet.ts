import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageNumber,
  Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import type { ContentRecord } from "./admin-api";
import { rows, strings, text } from "./admin-content";

export interface SkillSheetProfile { name: string; birthday: string }
export interface SkillSheetSummary { skillCategories: number; projects: number; generatedAt: Date }

const GREEN = "2E5144";
const PALE_GREEN = "EAF0EB";
const MUTED = "66756D";

function published(records: ContentRecord[]): ContentRecord[] {
  return records.filter(record => record.data.published !== false);
}

function infoRow(label: string, value: string): TableRow {
  return new TableRow({ children: [
    new TableCell({ shading: { fill: PALE_GREEN }, width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: GREEN })] })] }),
    new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, children: [new Paragraph(value || "—")] }),
  ] });
}

function detailParagraph(label: string, value: string): Paragraph {
  return new Paragraph({ spacing: { after: 90 }, children: [
    new TextRun({ text: `${label}  `, bold: true, color: GREEN }), new TextRun(value || "—"),
  ] });
}

function sectionHeading(value: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 170 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GREEN, space: 6 } },
    children: [new TextRun({ text: value, bold: true, color: GREEN })],
  });
}

function projectOrder(a: ContentRecord, b: ContentRecord): number {
  const current = Number(Boolean(b.data.current)) - Number(Boolean(a.data.current));
  if (current) return current;
  const year = Number(text(b.data.year)) - Number(text(a.data.year));
  if (year) return year;
  return Number(a.data.order || 0) - Number(b.data.order || 0);
}

export function skillSheetSummary(skills: ContentRecord[], projects: ContentRecord[], generatedAt = new Date()): SkillSheetSummary {
  return { skillCategories: published(skills).length, projects: published(projects).length, generatedAt };
}

export async function createSkillSheet(profile: SkillSheetProfile, skillRecords: ContentRecord[], projectRecords: ContentRecord[], generatedAt = new Date()): Promise<Blob> {
  const skills = published(skillRecords);
  const projects = published(projectRecords).sort(projectOrder);
  const generatedLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(generatedAt);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: "SKILL SHEET", bold: true, size: 38, color: GREEN })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 340 }, children: [new TextRun({ text: "スキルシート / 職務経歴", size: 22, color: MUTED })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [infoRow("氏名", profile.name), infoRow("生年月日", profile.birthday), infoRow("作成日時", `${generatedLabel} JST`)] }),
    sectionHeading("スキル"),
  ];
  for (const record of skills) {
    const data = record.data;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 100 }, children: [new TextRun({ text: text(data.heading) || text(data.label) || record.id, bold: true })] }));
    for (const group of rows(data.groups)) {
      const items = strings(group.items);
      if (items.length) children.push(detailParagraph(text(group.name) || "Stack", items.join(" / ")));
    }
  }
  children.push(sectionHeading("実績・職務経歴"));
  for (const [index, record] of projects.entries()) {
    const data = record.data;
    const stackLines = rows(data.stackGroups).map(group => {
      const values = strings(group.tags);
      return values.length ? `${text(group.label) || "Stack"}: ${values.join(" / ")}` : "";
    }).filter(Boolean);
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: index > 0 && index % 4 === 0, spacing: { before: 260, after: 90 }, children: [
        new TextRun({ text: text(data.title) || record.id, bold: true, color: GREEN }),
        ...(data.current ? [new TextRun({ text: "  CURRENT", bold: true, size: 16, color: "856A28" })] : []),
      ] }),
      detailParagraph("期間", text(data.period) || text(data.year)),
      detailParagraph("案件・会社", text(data.client)), detailParagraph("概要", text(data.summary)), detailParagraph("担当", text(data.role)),
    );
    const phases = strings(data.phases);
    if (phases.length) children.push(detailParagraph("担当フェーズ", phases.join(" / ")));
    if (stackLines.length) children.push(detailParagraph("技術スタック", stackLines.join("\n")));
  }
  const document = new Document({
    creator: "terutaro", title: "照屋 朝太郎 スキルシート", description: "管理画面の公開中データから生成したスキルシート",
    styles: { default: {
      document: { run: { font: "Yu Gothic", size: 20, color: "26372F" }, paragraph: { spacing: { line: 300, after: 80 } } },
      heading1: { run: { font: "Yu Gothic", size: 28, bold: true, color: GREEN } },
      heading2: { run: { font: "Yu Gothic", size: 23, bold: true, color: "26372F" } },
    } },
    sections: [{
      properties: { page: { margin: { top: 850, right: 850, bottom: 850, left: 850 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: "terutaro  /  ", color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
      ] })] }) }, children,
    }],
  });
  return Packer.toBlob(document);
}

export function skillSheetFilename(generatedAt = new Date()): string {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(generatedAt);
  return `terutaro-skill-sheet-${date}.docx`;
}
