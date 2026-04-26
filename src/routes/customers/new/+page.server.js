import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/db.js';
import { createCustomer } from '$lib/services/customers.js';

export async function load({ url }) {
	return { woId: parseInt(url.searchParams.get('wo')) || null };
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name')?.trim();
		const woId = parseInt(data.get('wo_id')) || null;
		if (!name) return fail(400, { error: 'Customer name is required', woId });

		let customerId;
		try {
			customerId = await createCustomer({ name, phone: data.get('phone')?.trim() });
			if (woId) {
				await db.query('UPDATE work_orders SET customer_id = ? WHERE id = ?', [
					customerId,
					woId,
				]);
			}
		} catch (err) {
			return fail(500, { error: err.message, woId });
		}
		redirect(303, woId ? `/wo/${woId}?customer_created=1` : `/customers`);
	},
};
