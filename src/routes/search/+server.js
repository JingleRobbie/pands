import { json } from '@sveltejs/kit';
import { db } from '$lib/db.js';

export async function GET({ url }) {
	const woId = parseInt(url.searchParams.get('wo_id'));
	if (woId) {
		const [[wo]] = await db.query(
			'SELECT id, so_number, customer_name, job_name, status FROM work_orders WHERE id = ?',
			[woId]
		);
		if (!wo) return json(null);

		const [activeRuns] = await db.query(
			`SELECT pr.id, pr.run_number, pr.status, pr.run_date
			 FROM production_runs pr
			 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
			 WHERE wol.wo_id = ? AND pr.status != 'COMPLETED'
			 ORDER BY pr.run_date IS NULL, pr.run_date, pr.run_number`,
			[woId]
		);

		const [allRuns] = await db.query(
			`SELECT pr.id, pr.run_number, pr.status, pr.run_date
			 FROM production_runs pr
			 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
			 WHERE wol.wo_id = ?
			 ORDER BY pr.run_date IS NULL, pr.run_date, pr.run_number`,
			[woId]
		);

		const [shipments] = await db.query(
			'SELECT id, shipment_number, status, ship_date FROM shipments WHERE wo_id = ? ORDER BY ship_date DESC',
			[woId]
		);

		return json({ wo, activeRuns, allRuns, shipments });
	}

	const q = url.searchParams.get('q')?.trim();
	if (!q) return json([]);

	const [wos] = await db.query(
		`SELECT id, so_number, customer_name, job_name, status
		 FROM work_orders WHERE so_number LIKE ? ORDER BY so_number LIMIT 10`,
		[`${q}%`]
	);

	return json(wos);
}
