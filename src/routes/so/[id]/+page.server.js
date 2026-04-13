import { db } from '$lib/db.js';
import { error } from '@sveltejs/kit';
import { getMatrixDataForSkus } from '$lib/services/inventory.js';

export async function load({ params }) {
	const [[so]] = await db.query('SELECT * FROM sales_orders WHERE id = ?', [params.id]);
	if (!so) error(404, 'SO not found');

	const [lines] = await db.query(
		`SELECT sol.*, ms.display_label,
		        COALESCE((SELECT SUM(pr.sqft_scheduled) FROM production_runs pr
		                  WHERE pr.so_line_id = sol.id AND pr.status != 'COMPLETED'), 0) AS sqft_scheduled,
		        COALESCE((SELECT SUM(pr.sqft_scheduled) FROM production_runs pr
		                  WHERE pr.so_line_id = sol.id AND pr.status = 'SCHEDULED'), 0) AS sqft_in_scheduled_runs
		 FROM sales_order_lines sol
		 JOIN material_skus ms ON ms.id = sol.sku_id
		 WHERE sol.so_id = ?`,
		[params.id]
	);

	const lineData = await Promise.all(
		lines.map(async (line) => {
			const [runs] = await db.query(
				`SELECT pr.*, ms.display_label AS sku_label
			 FROM production_runs pr
			 JOIN material_skus ms ON ms.id = pr.sku_id
			 WHERE pr.so_line_id = ? AND pr.status != 'COMPLETED'
			 ORDER BY pr.run_date`,
				[line.id]
			);
			const unscheduled =
				Number(line.sqft_ordered) -
				Number(line.sqft_produced) -
				Number(line.sqft_scheduled);
			return { line, runs, sqftUnscheduled: Math.max(unscheduled, 0) };
		})
	);

	const skuIds = [...new Set(lines.map((l) => l.sku_id))];
	const matrix = await getMatrixDataForSkus(skuIds);
	return { so, lineData, matrix };
}
