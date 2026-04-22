import { fail, redirect } from '@sveltejs/kit';
import { createCustomer } from '$lib/services/customers.js';

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name')?.trim();
		if (!name) return fail(400, { error: 'Customer name is required' });

		try {
			const id = await createCustomer({ name, phone: data.get('phone') });
			redirect(303, `/customers/${id}`);
		} catch (err) {
			return fail(500, { error: err.message });
		}
	},
};
