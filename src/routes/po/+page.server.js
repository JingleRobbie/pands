import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

export async function load({ url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') ?? '';
	const isFiltered = q || status;

	if (!isFiltered) {
		const today = localDate(new Date());
		const [overdue] = await db.query(
			`SELECT po.*, COUNT(pol.id) AS line_count
			 FROM purchase_orders po
			 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
			 WHERE po.expected_date < ? AND po.status = 'OPEN'
			 GROUP BY po.id ORDER BY po.expected_date, po.po_number`,
			[today]
		);
		const [upcoming] = await db.query(
			`SELECT po.*, COUNT(pol.id) AS line_count
			 FROM purchase_orders po
			 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
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
		`SELECT po.*, COUNT(pol.id) AS line_count
		 FROM purchase_orders po
		 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
		 ${whereClause}
		 GROUP BY po.id ORDER BY po.expected_date DESC, po.po_number`,
		params
	);
	return { upcoming: [], searchResults, q, status };
}
