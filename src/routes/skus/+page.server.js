import { db } from '$lib/db.js';

export async function load() {
	const [skus] = await db.query(
		'SELECT id, sku_code, thickness_in, width_in, r_value, display_label, sort_order, is_active, pebs FROM material_skus ORDER BY sort_order'
	);
	return { skus };
}
