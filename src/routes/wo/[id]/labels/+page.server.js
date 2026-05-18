import { db } from '$lib/db.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const [[wo]] = await db.query(
		`SELECT wo.*, c.name AS customer_name
		 FROM work_orders wo
		 JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ?`,
		[params.id]
	);
	if (!wo) error(404, 'Work order not found');

	const [rows] = await db.query(
		`-- cut_down faced rolls (CUT_LAMINATE / CUT_SHIP paths)
		 SELECT cd.id AS source_id, cd.rolls_scheduled,
		        rrl.thickness_in, cd.raw_roll_width_in, cd.raw_roll_length_ft,
		        cd.raw_vendor, wol.field_instructions, wol.rollfor
		 FROM cut_downs cd
		 LEFT JOIN raw_roll_lookup rrl ON rrl.id = cd.raw_roll_lookup_id
		 LEFT JOIN work_order_lines wol ON wol.id = cd.billing_line_id
		 WHERE cd.wo_id = ?
		   AND cd.status NOT IN ('CANCELLED')
		   AND LOWER(COALESCE(wol.facing, '')) NOT IN ('unfaced', '')

		 UNION ALL

		 -- unbranched faced lines (STANDARD path - no cut_down)
		 SELECT wol.id AS source_id, wol.qty AS rolls_scheduled,
		        wol.thickness_in, wol.width_in AS raw_roll_width_in,
		        wol.length_ft AS raw_roll_length_ft,
		        NULL AS raw_vendor, wol.field_instructions, wol.rollfor
		 FROM work_order_lines wol
		 WHERE wol.wo_id = ?
		   AND wol.parent_line_id IS NULL
		   AND LOWER(COALESCE(wol.facing, '')) NOT IN ('unfaced', '')
		   AND NOT EXISTS (
		     SELECT 1 FROM work_order_lines child WHERE child.parent_line_id = wol.id
		   )
		 ORDER BY source_id`,
		[params.id, params.id]
	);

	// Expand into one label entry per roll, numbered sequentially
	const labels = [];
	let seq = 1;
	for (const row of rows) {
		const rolls = row.rolls_scheduled ?? 1;
		for (let i = 0; i < rolls; i++) {
			labels.push({ ...row, rollNumber: seq++ });
		}
	}

	return { wo, labels };
}
