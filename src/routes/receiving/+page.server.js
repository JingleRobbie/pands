import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultFromDate() {
	const d = new Date();
	d.setDate(d.getDate() - 90);
	return localDate(d);
}

export async function load({ url }) {
	const today = localDate(new Date());
	const requested = url.searchParams.get('status') ?? '';
	const status = ['received', 'all'].includes(requested) ? requested : 'open';
	const requestedFrom = (url.searchParams.get('from') ?? '').trim();
	const from =
		status === 'open' ? '' : DATE_RE.test(requestedFrom) ? requestedFrom : defaultFromDate();

	if (status !== 'open') {
		const where = [];
		const params = [];
		if (status === 'received') {
			where.push("po.status = 'RECEIVED'");
		}
		if (from) {
			where.push(
				status === 'received'
					? 'COALESCE(receipts.received_at, po.expected_date) >= ?'
					: `CASE
					     WHEN po.status = 'RECEIVED' THEN COALESCE(receipts.received_at, po.expected_date)
					     ELSE po.expected_date
					   END >= ?`
			);
			params.push(from);
		}

		const [pos] = await db.query(
			`SELECT po.*, COALESCE(open_lines.open_lines, 0) AS open_lines, receipts.received_at
			 FROM purchase_orders po
			 LEFT JOIN (
			   SELECT po_id, COUNT(*) AS open_lines
			   FROM purchase_order_lines
			   WHERE status = 'OPEN'
			   GROUP BY po_id
			 ) open_lines ON open_lines.po_id = po.id
			 LEFT JOIN (
			   SELECT pol.po_id, DATE(MIN(it.created_at)) AS received_at
			   FROM purchase_order_lines pol
			   JOIN inventory_transactions it
			     ON it.reference_type = 'PO_LINE'
			    AND it.transaction_type = 'RECEIPT'
			    AND it.reference_id = pol.id
			   WHERE NOT EXISTS (
			     SELECT 1
			     FROM inventory_transactions reversal
			     WHERE reversal.transaction_type = 'RECEIPT_REVERSAL'
			       AND reversal.reverses_transaction_id = it.id
			   )
			   GROUP BY pol.po_id
			 ) receipts ON receipts.po_id = po.id
			 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			 ORDER BY COALESCE(receipts.received_at, po.expected_date) DESC, po.po_number`,
			params
		);
		return { status, from, overdue: [], upcoming: [], pos };
	}

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
	return { status, from, overdue, upcoming, pos: [] };
}
