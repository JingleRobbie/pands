import { db } from '$lib/db.js';
import { error } from '@sveltejs/kit';
import PDFDocument from 'pdfkit';

// Letter dimensions in points (1in = 72pt)
const PW = 612; // 8.5in
const PH = 792; // 11in
const MARGIN = 0.35 * 72; // 25.2pt
const LABEL_H = (PH - MARGIN * 2) / 2; // two labels per page
const CONTENT_X = MARGIN + 0.4 * 72;
const CONTENT_W = PW - MARGIN * 2 - 0.8 * 72;

const ROLLFOR_CATEGORIES = [
	{ value: 'roof',      match: (v) => /^roof$/i.test(v) },
	{ value: 'sidewalls', match: (v) => /^(sw|sidewall)$/i.test(v) },
	{ value: 'endwalls',  match: (v) => /^(ew|end\s*wall)$/i.test(v) },
	{ value: 'stock',     match: (v) => /^stock$/i.test(v) },
	{ value: 'other',     match: (v) => !/^(roof|sw|sidewall|ew|end\s*wall|stock)$/i.test(v) },
];

function categorize(rollfor) {
	const v = (rollfor ?? '').trim();
	for (const cat of ROLLFOR_CATEGORIES) {
		if (cat.match(v)) return cat.value;
	}
	return 'other';
}

const JM_BOILERPLATE = [
	{ bold: false, text: 'JOB SITE STORAGE: Store insulation in a dry area elevated above the ground or slab. Avoid contact with water or uncured concrete. Protect from weather.' },
	{ bold: true,  text: 'WARNING' },
	{ bold: false, text: 'Possible cancer hazard by inhalation. Can cause respiratory skin and eye irritation.' },
	{ bold: true,  text: 'PRECAUTIONARY MEASURES' },
	{ bold: false, text: 'Avoid breathing fiberglass dust, and contact with skin and eyes. Use a NIOSH approved dust/mist respirator. Wear long-sleeved, loose fitting clothing, gloves, and eye protection. Wash work clothes separately from other clothing, rinse washer thoroughly.' },
	{ bold: true,  text: 'FIRST AID MEASURES' },
	{ bold: false, text: 'EYE CONTACT - Flush eyes with water to remove dust. If symptoms persist, seek medical attention. SKIN CONTACT - Wash affected areas gently with soap and warm water after handling.' },
	{ bold: false, text: 'For additional information refer to the Johns Manville Material Safety Data Sheet, P.O. Box 5108, Denver, CO 80217-5108. 1-800-654-3103' },
];

const CT_BOILERPLATE = [
	{ bold: false, text: 'JOB SITE STORAGE: Store insulation in a dry area elevated above the ground or slab. Avoid contact with water or uncured concrete. Protect from weather.' },
	{ bold: true,  text: 'WARNING' },
	{ bold: false, text: 'Possible cancer hazard by inhalation. Can cause respiratory skin and eye irritation.' },
	{ bold: true,  text: 'PRECAUTIONARY MEASURES' },
	{ bold: false, text: 'Avoid breathing fiberglass dust, and contact with skin and eyes. Use a NIOSH approved dust/mist respirator. Wear long-sleeved, loose fitting clothing, gloves, and eye protection. Wash work clothes separately from other clothing, rinse washer thoroughly.' },
	{ bold: true,  text: 'FIRST AID MEASURES' },
	{ bold: false, text: 'EYE CONTACT - Flush eyes with water to remove dust. If symptoms persist, seek medical attention. SKIN CONTACT - Wash affected areas gently with soap and warm water after handling.' },
	{ bold: false, text: 'For product safety information refer to the CertainTeed Corporation Safety Data Sheet at certainteed.com or 1-800-233-8990.' },
];

function drawLabel(doc, labelTop, label, wo, rollNumber) {
	const x = CONTENT_X;
	const w = CONTENT_W;
	let y = labelTop + 0.35 * 72;

	// Company name + roll number
	doc.font('Helvetica-Bold').fontSize(22);
	doc.text(wo.customer_name.toUpperCase(), x, y, { width: w - 60, lineBreak: false });
	doc.font('Helvetica-Bold').fontSize(16);
	doc.text(String(rollNumber), x + w - 50, y, { width: 50, align: 'right' });
	y += 28;

	// PO NUMBER row
	doc.moveTo(MARGIN, y).lineTo(PW - MARGIN, y).lineWidth(0.5).stroke();
	y += 3;
	const poVal = wo.customer_po ?? wo.so_number;
	doc.font('Helvetica-Bold').fontSize(7).text('PO NUMBER', x, y, { width: 72, lineBreak: false });
	doc.font('Helvetica').fontSize(9).text(poVal, x + 80, y, { width: w - 80 });
	y += 13;

	// PROJECT NAME row
	doc.moveTo(MARGIN, y).lineTo(PW - MARGIN, y).lineWidth(0.5).stroke();
	y += 3;
	doc.font('Helvetica-Bold').fontSize(7).text('PROJECT NAME', x, y, { width: 80, lineBreak: false });
	doc.font('Helvetica-Bold').fontSize(11).text(label.job_name ?? wo.job_name ?? '', x + 80, y, { width: w - 80 });
	y += 16;

	// Dimensions block (thick borders top + bottom)
	const dimTop = y;
	const dimH = 60;
	doc.moveTo(MARGIN, dimTop).lineTo(PW - MARGIN, dimTop).lineWidth(1.5).stroke();
	doc.moveTo(MARGIN, dimTop + dimH).lineTo(PW - MARGIN, dimTop + dimH).lineWidth(1.5).stroke();

	const colW = w / 3;
	const dimLabels = ['Thickness', 'Width', 'Length'];
	const dimVals = [
		label.thickness_in != null ? `${label.thickness_in}"` : '-',
		label.raw_roll_width_in != null ? `${label.raw_roll_width_in}"` : '-',
		label.raw_roll_length_ft != null ? `${label.raw_roll_length_ft}'` : '-',
	];

	for (let i = 0; i < 3; i++) {
		const cx = x + colW * i;
		// Divider between columns
		if (i > 0) doc.moveTo(x + colW * i, dimTop).lineTo(x + colW * i, dimTop + dimH).lineWidth(0.5).stroke();
		doc.font('Helvetica-Bold').fontSize(10).text(dimLabels[i], cx, dimTop + 4, { width: colW, align: 'center' });
		doc.font('Helvetica-Bold').fontSize(26).text(dimVals[i], cx, dimTop + 16, { width: colW, align: 'center' });
	}
	y = dimTop + dimH + 6;

	// Instructions
	if (label.field_instructions) {
		doc.font('Helvetica-Bold').fontSize(9).text('INSTRUCTIONS', x, y, { width: w, align: 'center', underline: true });
		y += 12;
		doc.font('Helvetica-Bold').fontSize(10).text(label.field_instructions, x, y, { width: w, align: 'center' });
		y += 14;
	} else {
		y += 4;
	}

	// Divider
	doc.moveTo(MARGIN, y).lineTo(PW - MARGIN, y).lineWidth(0.75).stroke();
	y += 5;

	// Boilerplate
	const boilerplate = (label.raw_vendor === 'Certainteed') ? CT_BOILERPLATE : JM_BOILERPLATE;
	const maxY = labelTop + LABEL_H - 8;
	for (const line of boilerplate) {
		if (y >= maxY) break;
		doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6);
		const lineH = doc.heightOfString(line.text, { width: w });
		if (y + lineH > maxY) break;
		doc.text(line.text, x, y, { width: w });
		y += lineH + 1;
	}
}

export async function GET({ params, url, locals }) {
	if (!locals.appUser) return new Response('Unauthorized', { status: 401 });

	const [[wo]] = await db.query(
		`SELECT wo.*, c.name AS customer_name
		 FROM work_orders wo
		 JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ?`,
		[params.id]
	);
	if (!wo) error(404, 'Work order not found');

	const [rows] = await db.query(
		`SELECT cd.id AS source_id, cd.rolls_scheduled,
		        rrl.thickness_in, cd.raw_roll_width_in, cd.raw_roll_length_ft,
		        cd.raw_vendor, wol.field_instructions, wol.rollfor
		 FROM cut_downs cd
		 LEFT JOIN raw_roll_lookup rrl ON rrl.id = cd.raw_roll_lookup_id
		 LEFT JOIN work_order_lines wol ON wol.id = cd.billing_line_id
		 WHERE cd.wo_id = ?
		   AND cd.status NOT IN ('CANCELLED')
		   AND LOWER(COALESCE(wol.facing, '')) NOT IN ('unfaced', '')
		 UNION ALL
		 SELECT wol.id AS source_id, wol.qty AS rolls_scheduled,
		        wol.thickness_in, wol.width_in AS raw_roll_width_in,
		        wol.length_ft AS raw_roll_length_ft,
		        NULL AS raw_vendor, wol.field_instructions, wol.rollfor
		 FROM work_order_lines wol
		 WHERE wol.wo_id = ?
		   AND wol.parent_line_id IS NULL
		   AND LOWER(COALESCE(wol.facing, '')) NOT IN ('unfaced', '')
		   AND NOT EXISTS (SELECT 1 FROM work_order_lines c WHERE c.parent_line_id = wol.id)
		 ORDER BY source_id`,
		[params.id, params.id]
	);

	// Expand to per-roll entries
	let labels = [];
	let seq = 1;
	for (const row of rows) {
		const rolls = row.rolls_scheduled ?? 1;
		for (let i = 0; i < rolls; i++) labels.push({ ...row, rollNumber: seq++ });
	}

	// Apply category filter
	const category = url.searchParams.get('category') ?? '';
	if (category) {
		const cat = ROLLFOR_CATEGORIES.find((c) => c.value === category);
		if (cat) labels = labels.filter((l) => cat.match((l.rollfor ?? '').trim()));
	}

	if (!labels.length) return new Response('No labels to print', { status: 404 });

	// Generate PDF
	const pdfBuffer = await new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: false });
		const chunks = [];
		doc.on('data', (c) => chunks.push(c));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		for (let i = 0; i < labels.length; i += 2) {
			doc.addPage();
			// Dashed cut line between the two labels
			if (labels[i + 1]) {
				const midY = MARGIN + LABEL_H;
				doc.save()
					.dash(4, { space: 4 })
					.moveTo(MARGIN, midY).lineTo(PW - MARGIN, midY)
					.lineWidth(0.5).strokeColor('#999').stroke()
					.restore();
			}
			drawLabel(doc, MARGIN, labels[i], wo, labels[i].rollNumber);
			if (labels[i + 1]) {
				drawLabel(doc, MARGIN + LABEL_H, labels[i + 1], wo, labels[i + 1].rollNumber);
			}
		}

		doc.end();
	});

	return new Response(pdfBuffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="labels-${wo.so_number}.pdf"`,
		},
	});
}
