// Rebuild GovernorBrief-Governor-Summary.docx (site root). Run from the repo root:  node tests/summary/build.js   (needs the docx package)
const fs = require('fs');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, WidthType, ShadingType, BorderStyle, AlignmentType, HeadingLevel, Footer, PageNumber, VerticalAlign, LevelFormat, TableLayoutType } = d;

const MID = '102D3B', TEAL = '1B6368', BRASS = 'C4AE7A', IVORY = 'F4F5F2', LINE = 'C9D1D3', HINT = '4F5F66', FONT = 'Arial';
const W = 9638; // A4 text width with 2 cm margins
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const line = { style: BorderStyle.SINGLE, size: 6, color: LINE };
const allLines = { top: line, bottom: line, left: line, right: line };
const pad = { top: 90, bottom: 90, left: 120, right: 120 };

const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 21, color: MID, ...o });
const para = (t, o = {}, r = {}) => new Paragraph({ spacing: { before: 0, after: 100, line: 276 }, ...o, children: Array.isArray(t) ? t : [run(t, r)] });
const hint = (t) => para(t, { spacing: { before: 0, after: 60, line: 264 } }, { color: HINT, size: 19, italics: true });
const blank = (n = 1) => Array.from({ length: n }, () => para('', { spacing: { before: 0, after: 0, line: 300 } }));
const h1 = (step, title) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: step ? step.toUpperCase() + '   ' : '', font: FONT, size: 18, bold: true, color: TEAL, characterSpacing: 30 }), new TextRun({ text: title, font: FONT, size: 28, bold: true, color: MID })] });
const lead = (t) => para(t, { spacing: { before: 0, after: 140, line: 276 }, keepNext: true });

const cell = (children, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: pad, borders: allLines, verticalAlign: VerticalAlign.TOP, ...o, children });
const headCell = (t, w) => cell([para(t, { spacing: { before: 0, after: 0 } }, { bold: true, color: 'FFFFFF', size: 19 })], w, { shading: { type: ShadingType.CLEAR, fill: MID, color: 'auto' }, borders: { top: { style: BorderStyle.SINGLE, size: 6, color: MID }, bottom: { style: BorderStyle.SINGLE, size: 6, color: MID }, left: { style: BorderStyle.SINGLE, size: 6, color: MID }, right: { style: BorderStyle.SINGLE, size: 6, color: MID } } });
const labelCell = (t, w) => cell([para(t, { spacing: { before: 0, after: 0 } }, { bold: true, size: 20 })], w, { shading: { type: ShadingType.CLEAR, fill: IVORY, color: 'auto' } });
const emptyCell = (w, h) => cell(h ? [hint(h)] : [para('', { spacing: { before: 0, after: 0 } })], w);
const table = (widths, head, rows, minH = 0) => new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
  rows: [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((t, i) => headCell(t, widths[i])) }), ...rows.map(r => new TableRow({ cantSplit: true, ...(minH ? { height: { value: minH, rule: d.HeightRule.ATLEAST } } : {}), children: r.map((c, i) => c instanceof TableCell ? c : (i === 0 && typeof c === 'string' && c ? labelCell(c, widths[i]) : emptyCell(widths[i], c && c.hint))) }))] });
const box = (children, fill = IVORY) => new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], layout: TableLayoutType.FIXED,
  rows: [new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, margins: { top: 140, bottom: 140, left: 200, right: 200 }, shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 36, color: BRASS } }, children })] })] });
const gap = (a = 160) => new Paragraph({ spacing: { before: 0, after: a, line: 60, lineRule: 'exact' }, children: [] });
const num = (ref) => (t) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { before: 0, after: 80, line: 276 }, children: [run(t)] });

// ---- banner: the site header as a full-width midnight band
const logo = fs.readFileSync(__dirname + '/logo-lockup-white.png');
const banner = new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], layout: TableLayoutType.FIXED,
  rows: [new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, margins: { top: 200, bottom: 200, left: 240, right: 240 }, shading: { type: ShadingType.CLEAR, fill: MID, color: 'auto' },
    borders: { top: none, left: none, right: none, bottom: { style: BorderStyle.SINGLE, size: 24, color: BRASS } },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 253, height: 46 }, altText: { title: 'GovernorBrief', description: 'GovernorBrief. From Information to Assurance.', name: 'GovernorBrief logo' } })] })] })] })] });

const details = new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2100, 2719, 2100, 2719], layout: TableLayoutType.FIXED, rows: [
  new TableRow({ children: [labelCell('School or trust', 2100), emptyCell(2719), labelCell('Meeting date', 2100), emptyCell(2719)] }),
  new TableRow({ children: [labelCell('Prepared by', 2100), emptyCell(2719), labelCell('Period covered', 2100), emptyCell(2719)] }),
  new TableRow({ children: [labelCell('Subject of this summary', 2100), new TableCell({ width: { size: 7538, type: WidthType.DXA }, columnSpan: 3, margins: pad, borders: allLines, children: [hint('For example: attendance this term, the budget, safeguarding, or the whole school.')] })] }),
] });

const AREAS = ['Outcomes and curriculum', 'Attendance', 'Behaviour and inclusion', 'Safeguarding', 'Finance', 'Staffing', 'Premises, health and safety', 'Governance and compliance'];
const glance = table([2700, 1500, 3738, 1700], ['Area', 'Position', 'The reason, in one line', 'Since last report'], AREAS.map(a => [a, '', '', '']));

const evidence = table([2900, 1500, 2538, 2700], ['Measure', 'Our figure', 'Compared with', 'Source and date'], [
  [{ hint: 'For example: overall attendance' }, '', { hint: 'National figure, or our figure last year' }, { hint: 'Where the figure comes from and the date it was taken' }], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']].map(r => r.map(c => c === '' ? { hint: '' } : c)), 760);

const assurance = table([3400, 2738, 2000, 1500], ['What would give the board confidence', 'Second source to check it against', 'Who will follow up', 'By when'], [
  [{ hint: 'The evidence you could show governors' }, { hint: 'For example: a visit, a survey, an external review' }, { hint: '' }, { hint: '' }], [{ hint: '' }, { hint: '' }, { hint: '' }, { hint: '' }], [{ hint: '' }, { hint: '' }, { hint: '' }, { hint: '' }]], 760);

const impact = table([3000, 1600, 2638, 2400], ['What the board agreed last time', 'Owner', 'What has changed', 'How we know'], [
  [{ hint: '' }, { hint: '' }, { hint: '' }, { hint: '' }], [{ hint: '' }, { hint: '' }, { hint: '' }, { hint: '' }], [{ hint: '' }, { hint: '' }, { hint: '' }, { hint: '' }]], 520);

const decisions = table([6238, 3400], ['Decision or approval needed', 'What happens if it is not made today'], [[{ hint: '' }, { hint: '' }], [{ hint: '' }, { hint: '' }]], 520);


const link = (title, url, note) => new Paragraph({ spacing: { before: 0, after: 70, line: 264 }, children: [
  new d.ExternalHyperlink({ link: url, children: [new TextRun({ text: title, font: FONT, size: 20, color: TEAL, bold: true, underline: { type: d.UnderlineType.SINGLE, color: TEAL } })] }),
  new TextRun({ text: '  ' + note, font: FONT, size: 19, color: HINT })] });
const linkHead = (t) => para(t, { spacing: { before: 120, after: 70 }, keepNext: true }, { bold: true, size: 20 });
const G = 'https://www.gov.uk/';
const links = [
  linkHead('Your board\'s main guide'),
  link('Governance in maintained schools', G + 'guidance/governance-in-maintained-schools', 'DfE guide for governing bodies of maintained schools.'),
  link('Academy trust governance guide', G + 'government/publications/academy-trust-governance-guide', 'DfE guide for trustees, members and local governors.'),
  link('Academy trust handbook', G + 'guidance/academy-trust-handbook', 'The financial and governance rules every academy trust must follow.'),
  linkHead('By area of this summary'),
  link('Keeping children safe in education', G + 'government/publications/keeping-children-safe-in-education--2', 'Safeguarding: statutory guidance.'),
  link('Working together to improve school attendance', G + 'government/publications/working-together-to-improve-school-attendance', 'Attendance: statutory guidance.'),
  link('SEN and disabilities: guidance for governing boards', G + 'government/publications/sen-and-disability-duties-guidance-for-school-governing-boards', 'Inclusion.'),
  link('Schools financial value standard', G + 'government/publications/schools-financial-value-standard-sfvs', 'Finance, for maintained schools.'),
  link('Meeting digital and technology standards', G + 'guidance/meeting-digital-and-technology-standards-in-schools-and-colleges', 'Technology and cyber security.'),
];

const key = num('key'), qs = num('qs');

const doc = new Document({
  creator: 'GovernorBrief', title: 'Governor summary', description: 'A short summary for a governing board, in four steps: evidence, questions, assurance and impact.',
  styles: { default: { document: { run: { font: FONT, size: 21, color: MID } },
    heading1: { run: { font: FONT, size: 28, bold: true, color: MID }, paragraph: { spacing: { before: 320, after: 100 }, keepNext: true } },
    title: { run: { font: FONT, size: 52, bold: true, color: MID }, paragraph: { spacing: { before: 280, after: 60 }, keepNext: true } } } },
  numbering: { config: [
    { reference: 'key', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 400 } }, run: { bold: true, color: TEAL, font: FONT } } }] },
    { reference: 'qs', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 400 } }, run: { bold: true, color: TEAL, font: FONT } } }] } ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1247, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: BRASS, space: 6 } }, spacing: { before: 0, after: 40 }, children: [new TextRun({ text: 'GovernorBrief is an independent resource and is not affiliated with or endorsed by Ofsted or the Department for Education.', font: FONT, size: 16, color: HINT })] }),
      new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: 'governorbrief.co.uk', font: FONT, size: 16, bold: true, color: TEAL }), new TextRun({ text: '     Page ', font: FONT, size: 16, color: HINT }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: HINT }), new TextRun({ text: ' of ', font: FONT, size: 16, color: HINT }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: HINT })] }) ] }) },
    children: [
      banner,
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'Governor summary', font: FONT, size: 52, bold: true, color: MID })] }),
      para('A short report to the board in four steps: evidence, questions, assurance and impact.', { spacing: { before: 0, after: 200, line: 288 } }, { size: 24 }),
      details,
      gap(180),
      box([
        para('How to use this summary', { spacing: { before: 0, after: 60 }, keepNext: true }, { bold: true }),
        para('Keep it to three pages. Write for a governor who has ten minutes before the meeting. Replace the grey guidance with your own words, and delete any row you do not need.', { spacing: { before: 0, after: 60, line: 276 } }),
        para('Do not include anything that could identify an individual pupil or member of staff.', { spacing: { before: 0, after: 0, line: 276 } }, { bold: true }),
      ]),

      h1('', 'Three things the board should know'),
      lead('If governors read nothing else, they should read these.'),
      key(''), key(''), key(''),

      h1('', 'At a glance'),
      lead('Give each area one of three positions, in words: Secure, Watch or Concern. Under "Since last report", write Better, Same or Worse.'),
      glance,

      new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'STEP 1   ', font: FONT, size: 18, bold: true, color: TEAL, characterSpacing: 30 }), new TextRun({ text: 'Evidence', font: FONT, size: 28, bold: true, color: MID })] }),
      lead('What the evidence shows, and what it does not. Give the few figures that matter, each with something to compare it against.'),
      evidence,
      gap(140),
      para('What the figures do not tell us', { spacing: { before: 0, after: 60 }, keepNext: true }, { bold: true }),
      hint('For example: small numbers, a figure that is a year old, or a group the data does not cover.'),
      ...blank(2),

      h1('Step 2', 'Questions'),
      lead('The small number of questions this evidence raises for the board. Three is usually enough.'),
      qs(''), qs(''), qs(''),

      h1('Step 3', 'Assurance'),
      lead('For each question, what would give the board confidence, what it can be checked against, and who will follow up.'),
      assurance,

      new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'STEP 4   ', font: FONT, size: 18, bold: true, color: TEAL, characterSpacing: 30 }), new TextRun({ text: 'Impact', font: FONT, size: 28, bold: true, color: MID })] }),
      lead('Come back to what was agreed last time: what has changed, and how do we know?'),
      impact,

      h1('', 'Decisions for this meeting'),
      lead('List anything the board is being asked to decide or approve. Write "None" if the summary is for information only.'),
      decisions,

      h1('', 'Risks to keep in view'),
      lead('New or growing risks, and whether the controls in place are working.'),
      ...blank(2),

      gap(120),
      box([
        para('After the meeting', { spacing: { before: 0, after: 60 }, keepNext: true }, { bold: true }),
        para('Record the questions governors asked, the follow-up agreed and who owns it. Bring this summary back next time and start at Step 4.', { spacing: { before: 0, after: 0, line: 276 } }),
      ]),

      h1('', 'Official guidance for governors and trustees'),
      lead('Department for Education guidance that sits behind the areas in this summary. The links open on GOV.UK.'),
      ...links,
    ],
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(require('path').join(__dirname, '..', '..', 'GovernorBrief-Governor-Summary.docx'), b); console.log('written', b.length); });
