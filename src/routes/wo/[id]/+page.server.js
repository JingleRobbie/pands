import { db } from '$lib/db.js';
import { error } from '@sveltejs/kit';

export async function load({ params, locals }) {
	const [[wo]] = await db.query('SELECT * FROM work_orders WHERE id = ?', [params.id]);
	if (!wo) error(404, 'Work order not found');

	const [lines] = await db.query(
		`SELECT wol.*, ms.display_label
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.wo_id = ?
		 ORDER BY wol.id`,
		[params.id]
	);

	return { wo, lines, user: locals.appUser };
}
