import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { getAllCustomers } from '$lib/services/customers.js';
import { requireAdmin } from '$lib/auth.js';
import { deleteBranchLine } from '$lib/services/cutdown.js';
import {
	canLineBlockWoCompletion,
	deriveLineType,
	inferPathType,
	isLineProductionComplete,
} from '$lib/services/line-paths.js';

const PATH_BADGES = {
	LAMINATE: { label: 'Laminate', class: 'badge-blue' },
	CUT_DOWN_LAMINATE: { label: 'Cut-Down + Laminate', class: 'badge-amber' },
	CUT_DOWN_ONLY: { label: 'Cut-Down Only', class: 'badge-amber' },
	RAW: { label: 'Raw', class: 'badge-gray' },
};

function sumBy(lines, field) {
	return lines.reduce((total, line) => total + Number(line[field] ?? 0), 0);
}

function shipmentEquivalentRolls(line) {
	return Number(line.direct_shipments_shipped ?? 0) > 0 ||
		Number(line.cut_down_shipments_shipped ?? 0) > 0
		? Number(line.qty ?? 0)
		: Number(line.rolls_shipped ?? 0);
}

function buildProgress(line, children = []) {
	const hasCutDown = Number(line.cut_down_count ?? 0) > 0;
	const lineType = line.line_type;
	const inferredPath = inferPathType(line);
	const workflow =
		lineType === 'BILLING'
			? children.every((child) => inferPathType(child) === 'CUT_SHIP')
				? 'CUT_DOWN_ONLY'
				: 'CUT_DOWN_LAMINATE'
			: inferredPath === 'DIRECT_SHIP'
				? 'RAW'
				: inferredPath === 'CUT_SHIP'
					? 'CUT_DOWN_ONLY'
					: inferredPath === 'CUT_LAMINATE'
						? 'CUT_DOWN_LAMINATE'
						: 'LAMINATE';

	const path = PATH_BADGES[workflow] ?? PATH_BADGES.LAMINATE;

	const qty = lineType === 'BILLING' ? sumBy(children, 'qty') : Number(line.qty ?? 0);
	const produced =
		lineType === 'BILLING'
			? sumBy(children, 'rolls_produced')
			: Number(line.rolls_produced ?? 0);
	const productionScheduled =
		lineType === 'BILLING'
			? sumBy(children, 'production_scheduled_count')
			: Number(line.production_scheduled_count ?? 0);
	const productionQueued =
		lineType === 'BILLING'
			? sumBy(children, 'production_queue_count')
			: Number(line.production_queue_count ?? 0);
	const cutDownScheduled = Number(line.cut_down_scheduled_count ?? 0);
	const cutDownQueued = Number(line.cut_down_queue_count ?? 0);
	const shipped =
		lineType === 'BILLING'
			? sumBy(children, 'rolls_shipped') +
				(Number(line.cut_down_shipments_shipped ?? 0) > 0 ? Number(line.qty ?? 0) : 0)
			: shipmentEquivalentRolls(line);

	let status = { label: 'Open', class: 'badge-gray' };
	if (line.reconciliation_status === 'STALE') {
		status = { label: 'Needs Review', class: 'badge-amber' };
	} else if (shipped > 0) {
		status = {
			label: shipped >= qty ? 'Shipped' : `Shipped ${Math.min(shipped, qty)} / ${qty}`,
			class: 'badge-green',
		};
	} else if (produced >= qty && qty > 0) {
		status = { label: 'Produced', class: 'badge-green' };
	} else if (produced > 0) {
		status = { label: `Produced ${produced} / ${qty}`, class: 'badge-blue' };
	} else if (workflow === 'RAW') {
		status = { label: 'Open', class: 'badge-gray' };
	} else if (cutDownScheduled > 0) {
		status = { label: 'Cut-Down Scheduled', class: 'badge-blue' };
	} else if (cutDownQueued > 0) {
		status = { label: 'Cut-Down Queue', class: 'badge-gray' };
	} else if ((workflow === 'CUT_DOWN_ONLY' || workflow === 'CUT_DOWN_LAMINATE') && !hasCutDown) {
		status = { label: 'Cut-Down Queue', class: 'badge-gray' };
	} else if (workflow === 'CUT_DOWN_LAMINATE' && productionScheduled > 0) {
		status = { label: 'Production Scheduled', class: 'badge-blue' };
	} else if (workflow === 'CUT_DOWN_LAMINATE' && productionQueued > 0) {
		status = { label: 'Production Queue', class: 'badge-gray' };
	} else if (workflow === 'LAMINATE' && productionScheduled > 0) {
		status = { label: 'Production Scheduled', class: 'badge-blue' };
	} else if (workflow === 'LAMINATE') {
		status = { label: 'Production Queue', class: 'badge-gray' };
	}

	return {
		path,
		status,
	};
}

function attachProgress(lines) {
	const childrenByParent = new Map();
	for (const line of lines) {
		if (line.parent_line_id === null || line.parent_line_id === undefined) continue;
		const children = childrenByParent.get(line.parent_line_id) ?? [];
		children.push(line);
		childrenByParent.set(line.parent_line_id, children);
	}

	return lines.map((line) => ({
		...line,
		progress: buildProgress(line, childrenByParent.get(line.id) ?? []),
	}));
}

function displayInstructions(line) {
	const original = String(line.instructions ?? '').trim();
	const field = String(line.field_instructions ?? '').trim();
	return field && field !== original ? field : original;
}

function groupProductionLines(productionLines) {
	const groupsByParent = {};
	for (const line of productionLines) {
		const parentId = line.parent_line_id;
		const key = [
			line.rollfor ?? '',
			line.facing ?? '',
			line.thickness_in ?? '',
			line.width_in ?? '',
			line.length_ft ?? '',
			line.path_type ?? '',
		].join('|');
		const groups = groupsByParent[parentId] ?? [];
		let group = groups.find((g) => g.group_key === key);
		if (!group) {
			group = {
				...line,
				group_key: key,
				child_count: 0,
				child_ids: [],
				qty: 0,
				sqft: 0,
				rolls_produced: 0,
				rolls_scheduled: 0,
				rolls_shipped: 0,
				rolls_in_draft: 0,
				source_width_in: line.width_in,
			};
			groups.push(group);
			groupsByParent[parentId] = groups;
		}
		group.child_count += 1;
		group.child_ids.push(line.id);
		group.qty += Number(line.qty ?? 0);
		group.sqft += Number(line.sqft ?? 0);
		group.rolls_produced += Number(line.rolls_produced ?? 0);
		group.rolls_scheduled += Number(line.rolls_scheduled ?? 0);
		group.rolls_shipped += Number(line.rolls_shipped ?? 0);
		group.rolls_in_draft += Number(line.rolls_in_draft ?? 0);
		group.width_in =
			group.child_count > 1
				? `${group.child_count} @ ${group.source_width_in}`
				: group.source_width_in;
	}
	return groupsByParent;
}

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
		`SELECT wol.*, ms.display_label, ms.pebs,
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
		          SELECT COUNT(*)
		          FROM production_runs pr
		          WHERE pr.wo_line_id = wol.id AND pr.status = 'SCHEDULED'
		        ), 0) AS production_scheduled_count,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM production_runs pr
		          WHERE pr.wo_line_id = wol.id AND pr.status = 'UNSCHEDULED'
		        ), 0) AS production_queue_count,
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
		        ), 0) AS rolls_in_draft,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM cut_downs cd
		          WHERE cd.billing_line_id = wol.id
		        ), 0) AS cut_down_count,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM cut_downs cd
		          WHERE cd.billing_line_id = wol.id AND cd.status != 'COMPLETED'
		        ), 0) AS active_cut_down_count,
		        COALESCE((
		          SELECT SUM(cd.rolls_scheduled)
		          FROM cut_downs cd
		          WHERE cd.billing_line_id = wol.id AND cd.status != 'COMPLETED'
		        ), 0) AS cut_down_rolls_scheduled,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM cut_downs cd
		          WHERE cd.billing_line_id = wol.id AND cd.status = 'SCHEDULED'
		        ), 0) AS cut_down_scheduled_count,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM cut_downs cd
		          WHERE cd.billing_line_id = wol.id AND cd.status = 'UNSCHEDULED'
		        ), 0) AS cut_down_queue_count,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM shipment_lines sl
		          JOIN shipments s ON s.id = sl.shipment_id
		          WHERE sl.wo_line_id = wol.id AND s.status = 'SHIPPED'
		        ), 0) AS direct_shipments_shipped,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM shipment_lines sl
		          JOIN cut_downs cd ON cd.id = sl.cut_down_id
		          JOIN shipments s ON s.id = sl.shipment_id
		          WHERE cd.billing_line_id = wol.id AND s.status = 'SHIPPED'
		        ), 0) AS cut_down_shipments_shipped
		 FROM work_order_lines wol
		 JOIN material_skus ms ON ms.id = wol.sku_id
		 WHERE wol.wo_id = ?
		 ORDER BY wol.id`,
		[params.id]
	);

	const lines = attachProgress(
		rawLines.map((l) => ({
			...l,
			line_type: deriveLineType(l),
			display_instructions: displayInstructions(l),
		}))
	);

	const billingLines = lines.filter((l) => l.line_type === 'BILLING');
	const productionLines = lines.filter((l) => l.line_type === 'PRODUCTION');
	const unbranchedLines = lines.filter((l) => l.line_type === 'UNBRANCHED');
	const productionGroupsByParent = groupProductionLines(productionLines);

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
		productionGroupsByParent,
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
				completeError: 'Work order has stale billing lines - reconcile before completing.',
			});
		if (Number(incomplete) > 0)
			return fail(400, { completeError: 'Not all lines are fully produced.' });
		await db.query("UPDATE work_orders SET status = 'COMPLETE' WHERE id = ?", [woId]);
		redirect(303, `/wo/${woId}`);
	},

	updateFieldInstructions: async ({ request, params, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;
		const data = await request.formData();
		const lineId = parseInt(data.get('line_id'));
		const fieldInstructions = data.get('field_instructions')?.trim() || null;
		if (!lineId) return fail(400, { instructionError: 'Line ID required.' });
		const [result] = await db.query(
			'UPDATE work_order_lines SET field_instructions = ? WHERE id = ? AND wo_id = ?',
			[fieldInstructions, lineId, params.id]
		);
		if (result.affectedRows === 0)
			return fail(404, { instructionError: 'Work order line not found.' });
		return { fieldInstructionsUpdated: true };
	},

	updateCustomerPo: async ({ request, params }) => {
		const data = await request.formData();
		const customerPo = data.get('customer_po')?.trim() || null;
		await db.query('UPDATE work_orders SET customer_po = ? WHERE id = ?', [customerPo, params.id]);
		redirect(303, `/wo/${params.id}`);
	},

	updateShipDate: async ({ request, params }) => {
		const data = await request.formData();
		const shipAsap = data.get('ship_asap') === '1';
		const raw = data.get('ship_date')?.trim() ?? '';
		const shipDate = shipAsap ? null : (raw || null);
		await db.query('UPDATE work_orders SET ship_date = ?, ship_asap = ? WHERE id = ?', [
			shipDate,
			shipAsap ? 1 : 0,
			params.id,
		]);
		redirect(303, `/wo/${params.id}`);
	},

	deleteContact: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		if (!id) return fail(400, {});
		await db.query('DELETE FROM contacts WHERE id = ?', [id]);
		return { contactDeleted: true };
	},

	deleteBranch: async ({ request, params, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;

		const data = await request.formData();
		const lineId = parseInt(data.get('line_id'));
		if (!lineId) return fail(400, { branchError: 'Cut-down setup line is required.' });

		try {
			await deleteBranchLine(lineId, parseInt(params.id), locals.appUser.id);
		} catch (err) {
			return fail(400, { branchError: err.message });
		}

		redirect(303, `/wo/${params.id}`);
	},
};
