import { db } from '$lib/db.js';

export async function load({ url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') ?? '';
	const isFiltered = q || status;

	if (!isFiltered) {
		const [sos] = await db.query(
			`SELECT so.*, COUNT(sol.id) AS line_count
			 FROM sales_orders so
			 LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
			 WHERE so.status IN ('OPEN','IN_PROGRESS')
			 GROUP BY so.id ORDER BY so.ship_date, so.so_number`
		);
		return { sos, searchResults: null, q: '', status: '' };
	}

	const params = [];
	const where = [];
	if (status && status !== 'all') {
		where.push('so.status = ?');
		params.push(status.toUpperCase());
	}
	if (q) {
		where.push('(so.so_number LIKE ? OR so.customer_name LIKE ? OR so.job_name LIKE ?)');
		params.push(`%${q}%`, `%${q}%`, `%${q}%`);
	}
	const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const [searchResults] = await db.query(
		`SELECT so.*, COUNT(sol.id) AS line_count
		 FROM sales_orders so
		 LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
		 ${whereClause}
		 GROUP BY so.id ORDER BY so.ship_date DESC, so.so_number`,
		params
	);
	return { sos: [], searchResults, q, status };
}
