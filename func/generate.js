/**
 * /api/generate
 * Receives docgen JSON from the AI and generates the actual file.
 * Returns the file as base64 with metadata for client-side download.
 */

const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
    LevelFormat, Header, Footer, PageNumber, PageBreak
} = require('docx');

// ─── DOCX ────────────────────────────────────────────────────────────────────

function buildDocx(content) {
    const { sections = [] } = content;

    // Numbering config for lists
    const numberingConfig = [
        {
            reference: 'bullets',
            levels: [{
                level: 0, format: LevelFormat.BULLET, text: '•',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } }
            }]
        },
        {
            reference: 'numbers',
            levels: [{
                level: 0, format: LevelFormat.DECIMAL, text: '%1.',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } }
            }]
        }
    ];

    const children = [];

    for (const block of sections) {
        // Heading
        if (block.heading !== undefined) {
            const levelMap = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
            children.push(new Paragraph({
                heading: levelMap[block.level || 1] || HeadingLevel.HEADING_1,
                children: [new TextRun({ text: block.heading, bold: true })]
            }));
            continue;
        }

        // Text paragraph
        if (block.text !== undefined) {
            children.push(new Paragraph({
                alignment: block.center ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [new TextRun({
                    text: block.text,
                    bold: block.bold || false,
                    italics: block.italic || false,
                    size: block.size ? block.size * 2 : undefined
                })]
            }));
            continue;
        }

        // List
        if (block.list !== undefined) {
            const ref = block.ordered ? 'numbers' : 'bullets';
            for (const item of block.list) {
                children.push(new Paragraph({
                    numbering: { reference: ref, level: 0 },
                    children: [new TextRun({ text: item })]
                }));
            }
            continue;
        }

        // Table
        if (block.table !== undefined) {
            const { headers = [], rows = [] } = block.table;
            const colCount  = headers.length || (rows[0]?.length ?? 1);
            const tableWidth = 9360;
            const colWidth  = Math.floor(tableWidth / colCount);
            const colWidths = Array(colCount).fill(colWidth);
            const border    = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
            const borders   = { top: border, bottom: border, left: border, right: border };

            const headerRow = new TableRow({
                children: headers.map(h => new TableCell({
                    borders,
                    width: { size: colWidth, type: WidthType.DXA },
                    shading: { fill: '2D4A8A', type: ShadingType.CLEAR },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: h, bold: true, color: 'FFFFFF' })]
                    })]
                }))
            });

            const dataRows = rows.map((row, ri) => new TableRow({
                children: row.map(cell => new TableCell({
                    borders,
                    width: { size: colWidth, type: WidthType.DXA },
                    shading: { fill: ri % 2 === 0 ? 'F5F7FF' : 'FFFFFF', type: ShadingType.CLEAR },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    children: [new Paragraph({ children: [new TextRun({ text: String(cell ?? '') })] })]
                }))
            }));

            children.push(new Table({
                width: { size: tableWidth, type: WidthType.DXA },
                columnWidths: colWidths,
                rows: [headerRow, ...dataRows]
            }));
            children.push(new Paragraph({ children: [new TextRun('')] })); // spacing after table
            continue;
        }

        // Page break
        if (block.pageBreak) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
        }
    }

    const doc = new Document({
        numbering: { config: numberingConfig },
        styles: {
            default: { document: { run: { font: 'Calibri', size: 24 } } },
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 36, bold: true, color: '2D4A8A', font: 'Calibri' },
                    paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 }
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 28, bold: true, color: '3D5FA0', font: 'Calibri' },
                    paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 }
                },
                {
                    id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 24, bold: true, color: '4A6DB5', font: 'Calibri' },
                    paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 }
                }
            ]
        },
        sections: [{
            properties: {
                page: {
                    size: { width: 12240, height: 15840 },
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                }
            },
            headers: {
                default: new Header({
                    children: [new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: 'Generado por Z.ai Chat', color: '888888', size: 18 })]
                    })]
                })
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: 'Página ', color: '888888', size: 18 }),
                            new TextRun({ children: [PageNumber.CURRENT], color: '888888', size: 18 })
                        ]
                    })]
                })
            },
            children
        }]
    });

    return Packer.toBuffer(doc);
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

async function buildXlsx(content) {
    const ExcelJS = require('exceljs');
    const { sheets = [] } = content;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Z.ai Chat';
    wb.created = new Date();

    for (const sheetDef of sheets) {
        const ws = wb.addWorksheet(sheetDef.name || 'Hoja1');
        const headers = sheetDef.headers || [];
        const rows    = sheetDef.rows    || [];

        if (headers.length > 0) {
            ws.columns = headers.map((h, i) => ({
                header: h,
                key: `col${i}`,
                width: Math.max(15, String(h).length + 4)
            }));

            // Style header row
            ws.getRow(1).eachCell(cell => {
                cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
                cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D4A8A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border    = {
                    top: { style: 'thin' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' }
                };
            });
            ws.getRow(1).height = 22;

            // Add data rows
            rows.forEach((row, ri) => {
                const dataRow = ws.addRow(row);
                dataRow.eachCell(cell => {
                    cell.fill = {
                        type: 'pattern', pattern: 'solid',
                        fgColor: { argb: ri % 2 === 0 ? 'FFF5F7FF' : 'FFFFFFFF' }
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
                    };
                });
            });
        }
    }

    return wb.xlsx.writeBuffer();
}

// ─── PPTX ────────────────────────────────────────────────────────────────────

function buildPptx(content, title) {
    const PptxGenJS = require('pptxgenjs');
    const { slides = [] } = content;

    const prs = new PptxGenJS();
    prs.layout  = 'LAYOUT_16x9';
    prs.author  = 'Z.ai Chat';
    prs.company = 'Z.ai';
    prs.title   = title || 'Presentación';

    const COLORS = {
        bg:      '0F1B3C',
        accent:  '4A7FFF',
        accent2: '7FAAFF',
        text:    'FFFFFF',
        sub:     'AABBDD'
    };

    slides.forEach((slideDef, idx) => {
        const slide = prs.addSlide();
        slide.background = { color: COLORS.bg };

        // Accent bar top
        slide.addShape(prs.ShapeType.rect, {
            x: 0, y: 0, w: '100%', h: 0.08,
            fill: { color: COLORS.accent }
        });

        // Slide number (cover is idx 0)
        if (idx === 0) {
            // Cover slide
            slide.addText(slideDef.title || '', {
                x: 0.5, y: 2.2, w: 9, h: 1.5,
                fontSize: 36, bold: true, color: COLORS.text,
                align: 'center', fontFace: 'Calibri'
            });
            if (slideDef.body?.length) {
                slide.addText(Array.isArray(slideDef.body) ? slideDef.body.join(' • ') : slideDef.body, {
                    x: 0.5, y: 3.9, w: 9, h: 0.8,
                    fontSize: 18, color: COLORS.sub,
                    align: 'center', fontFace: 'Calibri'
                });
            }
        } else {
            // Content slide
            slide.addText(slideDef.title || '', {
                x: 0.5, y: 0.2, w: 9, h: 0.8,
                fontSize: 24, bold: true, color: COLORS.accent2,
                fontFace: 'Calibri'
            });

            // Divider
            slide.addShape(prs.ShapeType.line, {
                x: 0.5, y: 1.05, w: 9, h: 0,
                line: { color: COLORS.accent, width: 1 }
            });

            const body = Array.isArray(slideDef.body) ? slideDef.body : [slideDef.body || ''];
            const bulletItems = body.map(b => ({ text: b, options: { bullet: true, indentLevel: 0 } }));

            slide.addText(bulletItems, {
                x: 0.5, y: 1.2, w: 9, h: 3.8,
                fontSize: 16, color: COLORS.text,
                fontFace: 'Calibri', valign: 'top',
                bullet: { type: 'bullet', code: '2022' }
            });
        }

        // Footer
        slide.addText(`${title || 'Presentación'} | Slide ${idx + 1}`, {
            x: 0, y: 5.3, w: '100%', h: 0.3,
            fontSize: 9, color: COLORS.sub, align: 'center'
        });
    });

    return prs.write({ outputType: 'nodebuffer' });
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function buildCsv(content) {
    const { headers = [], rows = [] } = content;
    const lines = [];
    if (headers.length) lines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
    for (const row of rows) {
        lines.push(row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
    }
    return Buffer.from(lines.join('\n'), 'utf-8');
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

const MIME_TYPES = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv:  'text/csv; charset=utf-8',
    txt:  'text/plain; charset=utf-8',
    html: 'text/html; charset=utf-8'
};

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { type, filename, title, content } = req.body;

    if (!type || !content) {
        return res.status(400).json({ error: 'Faltan campos: type, content' });
    }

    const safeFilename = (filename || `documento_${Date.now()}`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const ext = type.toLowerCase();

    try {
        let buffer;

        switch (ext) {
            case 'docx': buffer = await buildDocx(content); break;
            case 'xlsx': buffer = await buildXlsx(content); break;
            case 'pptx': buffer = await buildPptx(content, title); break;
            case 'csv':  buffer = buildCsv(content); break;
            case 'txt':  buffer = Buffer.from(content.body || '', 'utf-8'); break;
            case 'html': buffer = Buffer.from(content.body || '', 'utf-8'); break;
            default: return res.status(400).json({ error: `Tipo no soportado: ${type}` });
        }

        const base64 = buffer.toString('base64');
        const mime   = MIME_TYPES[ext] || 'application/octet-stream';

        return res.json({
            status:   true,
            filename: `${safeFilename}.${ext}`,
            mime,
            base64,
            size: buffer.length
        });

    } catch (e) {
        console.error('Generate error:', e);
        return res.status(500).json({ error: e.message });
    }
};
