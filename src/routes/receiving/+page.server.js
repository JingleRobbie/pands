import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

export async function load() {
	const today = localDate(new Date());
	const baseQuery = `
		SELECT po.*, COUNT(pol.id) AS open_lines
		FROM purchase_orders po
		JOIN purchase_order_lines pol ON pol.po_id = po.id AND pol.status = 'OPEN'
		WHERE po.status = 'OPEN'`;

	const [overdue] = await db.query(
		`${baseQuery} AND po.expected_date < ?
		GROUP BY po.id ORDER BY po.expected_date, po.po_number`,
		[today]
	);
	const [upcoming] = await db.query(
		`${baseQuery} AND po.expected_date >= ? GROUP BY po.id ORDER BY po.expected_date, po.po_number`,
		[today]
	);
	return { overdue, upcoming };
}
