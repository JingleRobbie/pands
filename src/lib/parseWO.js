import * as XLSX from 'xlsx';

function colLetters(n) {
	let s = '';
	while (n > 0) {
		const m = (n - 1) % 26;
		s = String.fromCharCode(65 + m) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

function cell(sheet, addr) {
	const c = sheet[addr];
	if (!c) return '';
	if (c.w !== undefined && c.w !== null) return c.w;
	if (c.v !== undefined && c.v !== null) return c.v;
	return '';
}

function clean(v) {
	if (typeof v === 'string') return v.trim();
	return v;
}

function isBlank(v) {
	return v === '' || v === null || v === undefined;
}

function splitAccessory(raw) {
	const s = String(raw).trim();
	if (!s) return { part_number: '', description: '' };
	const idx = s.search(/\s/);
	if (idx === -1) return { part_number: s, description: '' };
	return { part_number: s.slice(0, idx), description: s.slice(idx + 1).trim() };
}

export function parseWorkOrderExcel(buffer) {
	const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
	const sheet = wb.Sheets['Work Order'];
	if (!sheet) throw new Error("Sheet 'Work Order' not found in workbook");

	const addr1 = cell(sheet, 'N4');
	const addr2 = cell(sheet, 'N5');
	const deliveryAddress = [addr1, addr2]
		.map(clean)
		.filter((v) => !isBlank(v))
		.join(', ');

	const header = {
		so_number: clean(cell(sheet, 'P11')),
		po_number: clean(cell(sheet, 'J2')),
		customer: clean(cell(sheet, 'C1')),
		branch: clean(cell(sheet, 'I1')),
		contact: clean(cell(sheet, 'C2')),
		phone: clean(cell(sheet, 'G2')),
		date_received: clean(cell(sheet, 'K1')),
		deliver_on: clean(cell(sheet, 'O1')),
		job_name: clean(cell(sheet, 'N3')),
		delivery_address: deliveryAddress,
	};

	const accessories = [];
	for (let r = 5; r <= 9; r++) {
		const qty = cell(sheet, `H${r}`);
		if (isBlank(qty)) continue;
		const { part_number, description } = splitAccessory(cell(sheet, `I${r}`));
		accessories.push({ qty: clean(qty), part_number, description });
	}

	const lines = [];
	const tabCol = colLetters(65); // BM
	for (let r = 14; r <= 113; r++) {
		const b = cell(sheet, `B${r}`);
		const c = cell(sheet, `C${r}`);
		const d = cell(sheet, `D${r}`);
		const e = cell(sheet, `E${r}`);
		const f = cell(sheet, `F${r}`);
		const g = cell(sheet, `G${r}`);
		if ([b, c, d, e, f, g].some(isBlank)) continue;

		lines.push({
			row: clean(cell(sheet, `A${r}`)),
			facing: clean(b),
			roll_qty: clean(c),
			thickness: clean(d),
			width: clean(e),
			length: clean(f),
			roll_for: clean(g),
			instructions: clean(cell(sheet, `H${r}`)),
			tab_type: clean(cell(sheet, `${tabCol}${r}`)),
		});
	}

	return { header, accessories, lines };
}
