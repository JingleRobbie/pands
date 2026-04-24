import { db } from '$lib/db.js';
import { error } from '@sveltejs/kit';

export async function load({ locals }) {
	if (locals.appUser?.role !== 'admin') error(403, 'Admin only');
	const [counts] = await db.query(`
		SELECT ic.id, ic.memo, ic.count_date, ic.created_at,
		       u.display_name AS created_by_name,
		       COUNT(it.id) AS sku_count
		FROM inventory_counts ic
		JOIN app_users u ON u.id = ic.created_by
		LEFT JOIN inventory_transactions it
		  ON it.reference_type = 'INVENTORY_COUNT' AND it.reference_id = ic.id
		GROUP BY ic.id
		ORDER BY ic.created_at DESC
	`);
	return { counts };
}
