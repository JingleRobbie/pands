import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultFromDate() {
	const d = new Date();
	d.setDate(d.getDate() - 90);
	return localDate(d);
}

async function attachLines(pos) {
	if (!pos.length) return;
	const ids = pos.map((p) => p.id);
	const ph = ids.map(() => '?').join(',');
	const [lines] = await db.query(
		`SELECT pol.po_id, ms.sku_code, pol.sqft_ordered
		 FROM purchase_order_lines pol
		 JOIN material_skus ms ON ms.id = pol.sku_id
		 WHERE pol.po_id IN (${ph})
		 ORDER BY ms.sort_order`,
		ids
	);
	const byPo = {};
	for (const l of lines) {
		if (!byPo[l.po_id]) byPo[l.po_id] = [];
		byPo[l.po_id].push({ sku_code: l.sku_code, sqft_ordered: l.sqft_ordered });
	}
	for (const po of pos) po.lines = byPo[po.id] ?? [];
}

const RECV_JOIN = `
	LEFT JOIN (
		SELECT pol.po_id, DATE(MIN(it.created_at)) AS received_at
		FROM inventory_transactions it
		JOIN purchase_order_lines pol ON pol.id = it.reference_id
		WHERE it.reference_type = 'PO_LINE' AND it.transaction_type = 'RECEIPT'
		  AND NOT EXISTS (
		    SELECT 1
		    FROM inventory_transactions reversal
		    WHERE reversal.transaction_type = 'RECEIPT_REVERSAL'
		      AND reversal.reverses_transaction_id = it.id
		  )
		GROUP BY pol.po_id
	) recv ON recv.po_id = po.id`;

export async function load({ url, locals }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') ?? '';
	const requestedFrom = (url.searchParams.get('from') ?? '').trim();
	const from = status ? (DATE_RE.test(requestedFrom) ? requestedFrom : defaultFromDate()) : '';
	const isFiltered = q || status;

	if (!isFiltered) {
		const today = localDate(new Date());
		const [overdue] = await db.query(
			`SELECT po.*, COUNT(pol.id) AS line_count, recv.received_at
			 FROM purchase_orders po
			 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
			 ${RECV_JOIN}
			 WHERE po.expected_date < ? AND po.status = 'OPEN'
			 GROUP BY po.id ORDER BY po.expected_date, po.po_number`,
			[today]
		);
		const [upcoming] = await db.query(
			`SELECT po.*, COUNT(pol.id) AS line_count, recv.received_at
			 FROM purchase_orders po
			 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
			 ${RECV_JOIN}
			 WHERE po.expected_date >= ? AND po.status != 'CANCELLED'
			 GROUP BY po.id ORDER BY po.expected_date, po.po_number`,
			[today]
		);
		await Promise.all([attachLines(overdue), attachLines(upcoming)]);
		return { overdue, upcoming, searchResults: null, q: '', status: '', user: locals.appUser };
	}

	const params = [];
	const where = [];
	if (status && status !== 'all') {
		where.push('po.status = ?');
		params.push(status.toUpperCase());
	}
	if (from) {
		where.push(
			status === 'open' || status === 'cancelled'
				? 'po.expected_date >= ?'
				: `CASE
				     WHEN po.status = 'RECEIVED' THEN COALESCE(recv.received_at, po.expected_date)
				     ELSE po.expected_date
				   END >= ?`
		);
		params.push(from);
	}
	if (q) {
		where.push('(po.po_number LIKE ? OR po.vendor_name LIKE ?)');
		params.push(`%${q}%`, `%${q}%`);
	}
	const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const [searchResults] = await db.query(
		`SELECT po.*, COUNT(pol.id) AS line_count, recv.received_at
		 FROM purchase_orders po
		 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
		 ${RECV_JOIN}
		 ${whereClause}
		 GROUP BY po.id ORDER BY po.expected_date DESC, po.po_number`,
		params
	);
	await attachLines(searchResults);
	return { upcoming: [], searchResults, q, status, from, user: locals.appUser };
}
