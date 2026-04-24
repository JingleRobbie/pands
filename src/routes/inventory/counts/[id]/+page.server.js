import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ locals, params }) {
	if (locals.appUser?.role !== 'admin') error(403, 'Admin only');

	const [[count]] = await db.query(
		`SELECT ic.id, ic.memo, ic.count_date, ic.created_at,
		        u.display_name AS created_by_name
		 FROM inventory_counts ic
		 JOIN app_users u ON u.id = ic.created_by
		 WHERE ic.id = ?`,
		[params.id]
	);
	if (!count) error(404, 'Count not found');

	const [lines] = await db.query(
		`SELECT it.transaction_type, it.sqft_quantity, it.counted_sqft,
		        ms.display_label
		 FROM inventory_transactions it
		 JOIN material_skus ms ON ms.id = it.sku_id
		 WHERE it.reference_type = 'INVENTORY_COUNT' AND it.reference_id = ?
		 ORDER BY ms.sort_order, ms.thickness_in, ms.width_in`,
		[params.id]
	);

	return { count, lines };
}

export const actions = {
	delete: async ({ locals, params }) => {
		if (locals.appUser?.role !== 'admin') error(403, 'Admin only');
		const conn = await db.getConnection();
		try {
			await conn.beginTransaction();
			await conn.query(
				`DELETE FROM inventory_transactions
				 WHERE reference_type = 'INVENTORY_COUNT' AND reference_id = ?`,
				[params.id]
			);
			await conn.query('DELETE FROM inventory_counts WHERE id = ?', [params.id]);
			await conn.commit();
		} catch (err) {
			await conn.rollback();
			return fail(500, { error: err.message });
		} finally {
			conn.release();
		}
		redirect(303, '/inventory/counts');
	},
};
