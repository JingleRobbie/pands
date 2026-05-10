import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { getAllCustomers } from '$lib/services/customers.js';
import { requireAdmin } from '$lib/auth.js';
import {
	canLineBlockWoCompletion,
	deriveLineType,
	isLineProductionComplete,
} from '$lib/services/line-paths.js';

export async function load({ params, locals, url }) {
	const [[wo]] = await db.query(
		`SELECT wo.*, c.name AS customer_display_name
		 FROM work_orders wo
		 LEFT JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ?`,
		[params.id]
	);
	if (!wo) error(404, 'Work order not found');

	const [rawLines] = await db.query(
		`SELECT wol.*, ms.display_label,
		        wol.parent_line_id,
		        wol.path_type,
		        wol.reconciliation_status,
		        (SELECT COUNT(*) FROM work_order_lines c WHERE c.parent_line_id = wol.id) AS child_count,
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

	const lines = rawLines.map((l) => ({
		...l,
		line_type: deriveLineType(l),
	}));

	const billingLines = lines.filter((l) => l.line_type === 'BILLING');
	const productionLines = lines.filter((l) => l.line_type === 'PRODUCTION');
	const unbranchedLines = lines.filter((l) => l.line_type === 'UNBRANCHED');

	const canComplete =
		wo.status !== 'COMPLETE' &&
		lines.every(isLineProductionComplete) &&
		!lines.some(canLineBlockWoCompletion);

	const [contacts] = await db.query('SELECT * FROM contacts WHERE wo_id = ? ORDER BY id', [
		params.id,
	]);

	const customers = await getAllCustomers();

	return {
		wo,
		lines,
		billingLines,
		productionLines,
		unbranchedLines,
		canComplete,
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

	completeWo: async ({ params, locals }) => {
		requireAdmin(locals);
		const woId = params.id;
		const [[{ stale }]] = await db.query(
			`SELECT COUNT(*) AS stale FROM work_order_lines
			 WHERE wo_id = ? AND parent_line_id IS NULL AND reconciliation_status = 'STALE'`,
			[woId]
		);
		const [[{ incomplete }]] = await db.query(
			`SELECT COUNT(*) AS incomplete FROM work_order_lines
			 WHERE wo_id = ?
			   AND rolls_produced < qty
			   AND (
			     parent_line_id IS NOT NULL
			     OR NOT EXISTS (
			       SELECT 1 FROM work_order_lines child
			       WHERE child.parent_line_id = work_order_lines.id
			     )
			   )`,
			[woId]
		);
		if (Number(stale) > 0)
			return fail(400, {
				completeError: 'Work order has stale billing lines — reconcile before completing.',
			});
		if (Number(incomplete) > 0)
			return fail(400, { completeError: 'Not all lines are fully produced.' });
		await db.query("UPDATE work_orders SET status = 'COMPLETE' WHERE id = ?", [woId]);
		redirect(303, `/wo/${woId}`);
	},

	deleteContact: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		if (!id) return fail(400, {});
		await db.query('DELETE FROM contacts WHERE id = ?', [id]);
		return { contactDeleted: true };
	},
};
