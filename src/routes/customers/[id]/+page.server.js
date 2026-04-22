import { fail, error } from '@sveltejs/kit';
import { getCustomer, updateCustomer } from '$lib/services/customers.js';
import { db } from '$lib/db.js';

export async function load({ params }) {
	const customer = await getCustomer(params.id);
	if (!customer) error(404, 'Customer not found');

	const [wos] = await db.query(
		'SELECT id, so_number, job_name, status FROM work_orders WHERE customer_id = ? ORDER BY created_at DESC',
		[params.id]
	);

	return { customer, wos };
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const name = data.get('name')?.trim();
		if (!name) return fail(400, { error: 'Customer name is required' });

		try {
			await updateCustomer(params.id, { name, phone: data.get('phone') });
		} catch (err) {
			return fail(500, { error: err.message });
		}
		return { success: true };
	},
};
