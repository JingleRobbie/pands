import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

export async function load({ url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const status = url.searchParams.get('status') ?? '';
	const isFiltered = q || status;
	const today = localDate();

	if (!isFiltered) {
		const [overdueRuns] = await db.query(
			`SELECT pr.*, ms.display_label, so.so_number, so.job_name
			 FROM production_runs pr
			 JOIN material_skus ms ON ms.id = pr.sku_id
			 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
			 JOIN sales_orders so ON so.id = sol.so_id
			 WHERE pr.run_date < ? AND pr.status = 'SCHEDULED'
			 ORDER BY pr.run_date, pr.run_number`,
			[today]
		);
		const [todayRuns] = await db.query(
			`SELECT pr.*, ms.display_label, so.so_number, so.job_name
			 FROM production_runs pr
			 JOIN material_skus ms ON ms.id = pr.sku_id
			 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
			 JOIN sales_orders so ON so.id = sol.so_id
			 WHERE pr.run_date = ? AND pr.status = 'SCHEDULED'
			 ORDER BY pr.run_number`,
			[today]
		);
		const [upcoming] = await db.query(
			`SELECT pr.*, ms.display_label, so.so_number, so.job_name
			 FROM production_runs pr
			 JOIN material_skus ms ON ms.id = pr.sku_id
			 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
			 JOIN sales_orders so ON so.id = sol.so_id
			 WHERE pr.run_date > ? AND pr.status = 'SCHEDULED'
			 ORDER BY pr.run_date, pr.run_number`,
			[today]
		);
		return { overdueRuns, todayRuns, upcoming, today, searchResults: null, q: '', status: '' };
	}

	const params = [];
	const where = [];
	if (status && status !== 'all') {
		where.push('pr.status = ?');
		params.push(status.toUpperCase());
	}
	if (q) {
		where.push('(pr.run_number LIKE ? OR so.job_name LIKE ? OR so.so_number LIKE ?)');
		params.push(`%${q}%`, `%${q}%`, `%${q}%`);
	}
	const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const [searchResults] = await db.query(
		`SELECT pr.*, ms.display_label, so.so_number, so.job_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 ${whereClause}
		 ORDER BY pr.run_date DESC, pr.run_number`,
		params
	);
	return { overdueRuns: [], todayRuns: [], upcoming: [], today, searchResults, q, status };
}
