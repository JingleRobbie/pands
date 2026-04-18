import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

const RECV_JOIN = `
	LEFT JOIN (
		SELECT pol.po_id, DATE(MIN(it.created_at)) AS received_at
		FROM inventory_transactions it
		JOIN purchase_order_lines pol ON pol.id = it.reference_id
		WHERE it.reference_type = 'PO_LINE' AND it.transaction_type = 'RECEIPT'
		GROUP BY pol.po_id
	) recv ON recv.po_id = po.id`;

export async function load({ url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') ?? '';
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
		return { overdue, upcoming, searchResults: null, q: '', status: '' };
	}

	const params = [];
	const where = [];
	if (status && status !== 'all') {
		where.push('po.status = ?');
		params.push(status.toUpperCase());
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
	return { upcoming: [], searchResults, q, status };
}
