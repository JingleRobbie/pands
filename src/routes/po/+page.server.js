import { db } from '$lib/db.js';

export async function load() {
	const today = new Date().toISOString().slice(0, 10);
	const [upcoming] = await db.query(
		`SELECT po.*, COUNT(pol.id) AS line_count
		 FROM purchase_orders po
		 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
		 WHERE po.expected_date >= ? AND po.status = 'OPEN'
		 GROUP BY po.id ORDER BY po.expected_date, po.po_number`,
		[today]
	);
	const [overdue] = await db.query(
		`SELECT po.*, COUNT(pol.id) AS line_count
		 FROM purchase_orders po
		 LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
		 WHERE po.expected_date < ? AND po.status = 'OPEN'
		 GROUP BY po.id ORDER BY po.expected_date`,
		[today]
	);
	return { upcoming, overdue };
}
