import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { getAllCustomers } from '$lib/services/customers.js';

export async function load({ params, locals, url }) {
	const [[wo]] = await db.query(
		`SELECT wo.*, c.name AS customer_display_name
		 FROM work_orders wo
		 LEFT JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ?`,
		[params.id]
	);
	if (!wo) error(404, 'Work order not found');

	const [lines] = await db.query(
		`SELECT wol.*, ms.display_label,
		        COALESCE((
		          SELECT SUM(pr.rolls_scheduled)
		          FROM production_runs pr
		          WHERE pr.wo_line_id = wol.id AND pr.status != 'COMPLETED'
		        ), 0) AS rolls_scheduled,
		        COALESCE((
		          SELECT SUM(sl.rolls)
		          FROM shipment_lines sl
		          JOIN production_runs pr2 ON pr2.id = sl.production_run_id
		          JOIN shipments s ON s.id = sl.shipment_id
		          WHERE pr2.wo_line_id = wol.id AND s.status = 'SHIPPED'
		        ), 0) AS rolls_shipped,
		        COALESCE((
		          SELECT SUM(sl.rolls)
		          FROM shipment_lines sl
		          JOIN production_runs pr2 ON pr2.id = sl.production_run_id
		          JOIN shipments s ON s.id = sl.shipment_id
		          WHERE pr2.wo_line_id = wol.id AND s.status = 'DRAFT'
		        ), 0) AS rolls_in_draft
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.wo_id = ?
		 ORDER BY wol.id`,
		[params.id]
	);

	const [contacts] = await db.query('SELECT * FROM contacts WHERE wo_id = ? ORDER BY id', [
		params.id,
	]);

	const customers = await getAllCustomers();

	return {
		wo,
		lines,
		contacts,
		customers,
		user: locals.appUser,
		justCreatedShipmentId: parseInt(url.searchParams.get('shipment_created')) || null,
		justCreatedCustomer: url.searchParams.get('customer_created') === '1',
	};
}

export const actions = {
	linkCustomer: async ({ request, params }) => {
		const data = await request.formData();
		const customerId = parseInt(data.get('customer_id'));
		if (!customerId) return fail(400, { linkError: 'Please select a customer.' });
		await db.query('UPDATE work_orders SET customer_id = ? WHERE id = ?', [
			customerId,
			params.id,
		]);
		redirect(303, `/wo/${params.id}`);
	},

	addContact: async ({ request, params }) => {
		const data = await request.formData();
		const name = data.get('name')?.trim();
		if (!name) return fail(400, { contactError: 'Contact name is required.' });
		await db.query(
			'INSERT INTO contacts (wo_id, name, phone, email, role) VALUES (?, ?, ?, ?, ?)',
			[
				params.id,
				name,
				data.get('phone') || null,
				data.get('email') || null,
				data.get('role') || null,
			]
		);
		return { contactAdded: true };
	},

	deleteContact: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		if (!id) return fail(400, {});
		await db.query('DELETE FROM contacts WHERE id = ?', [id]);
		return { contactDeleted: true };
	},
};
