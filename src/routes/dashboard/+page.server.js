import { db } from '$lib/db.js';
import { fail, redirect } from '@sveltejs/kit';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function load({ locals }) {
	const [overduePos] = await db.query(
		`SELECT po.id, po.po_number, po.vendor_name,
		        DATE_FORMAT(po.expected_date, '%Y-%m-%d') AS expected_date
		 FROM purchase_orders po
		 WHERE po.status = 'OPEN' AND po.expected_date < CURDATE()
		 ORDER BY po.expected_date`
	);

	const [overdueRuns] = await db.query(
		`SELECT pr.id, pr.run_number, DATE_FORMAT(pr.run_date, '%Y-%m-%d') AS run_date,
		        wo.id AS wo_id, wo.so_number, wo.job_name, wo.customer_name
		 FROM production_runs pr
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 WHERE pr.status = 'SCHEDULED' AND pr.run_date < CURDATE()
		 ORDER BY pr.run_date`
	);

	const [unscheduledRuns] = await db.query(
		`SELECT pr.id, pr.run_number,
		        wo.id AS wo_id, wo.so_number, wo.job_name, wo.customer_name,
		        DATE_FORMAT(wo.ship_date, '%Y-%m-%d') AS ship_date
		 FROM production_runs pr
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 WHERE pr.status = 'UNSCHEDULED'
		 ORDER BY wo.ship_date IS NULL, wo.ship_date, wo.so_number`
	);

	const [overdueCutDowns] = await db.query(
		`SELECT cd.id, DATE_FORMAT(cd.run_date, '%Y-%m-%d') AS run_date,
		        wo.id AS wo_id, wo.so_number, wo.job_name, wo.customer_name
		 FROM cut_downs cd
		 JOIN work_order_lines wol ON wol.id = cd.billing_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 WHERE cd.status = 'SCHEDULED' AND cd.run_date < CURDATE()
		 ORDER BY cd.run_date`
	);

	const [unscheduledCutDowns] = await db.query(
		`SELECT cd.id,
		        wo.id AS wo_id, wo.so_number, wo.job_name, wo.customer_name,
		        DATE_FORMAT(wo.ship_date, '%Y-%m-%d') AS ship_date
		 FROM cut_downs cd
		 JOIN work_order_lines wol ON wol.id = cd.billing_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 WHERE cd.status = 'UNSCHEDULED'
		 ORDER BY wo.ship_date IS NULL, wo.ship_date, wo.so_number`
	);

	const [overdueShipments] = await db.query(
		`SELECT s.id, s.shipment_number, DATE_FORMAT(s.ship_date, '%Y-%m-%d') AS ship_date,
		        wo.so_number, wo.job_name,
		        c.name AS customer_name
		 FROM shipments s
		 JOIN work_orders wo ON wo.id = s.wo_id
		 JOIN customers c ON c.id = s.customer_id
		 WHERE s.status = 'DRAFT' AND s.ship_date < CURDATE()
		 ORDER BY s.ship_date`
	);

	return {
		overduePos,
		overdueRuns,
		unscheduledRuns,
		overdueCutDowns,
		unscheduledCutDowns,
		overdueShipments,
		user: locals.appUser,
	};
}

export const actions = {
	rescheduleRun: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		const run_date = data.get('run_date');
		if (!id) return fail(400, { error: 'Missing id' });
		if (!DATE_RE.test(run_date)) return fail(400, { error: 'Invalid date' });
		await db.query(
			"UPDATE production_runs SET run_date = ?, status = 'SCHEDULED' WHERE id = ?",
			[run_date, id]
		);
		redirect(303, '/dashboard');
	},

	rescheduleCutDown: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		const run_date = data.get('run_date');
		if (!id) return fail(400, { error: 'Missing id' });
		if (!DATE_RE.test(run_date)) return fail(400, { error: 'Invalid date' });
		await db.query(
			"UPDATE cut_downs SET run_date = ?, status = 'SCHEDULED' WHERE id = ?",
			[run_date, id]
		);
		redirect(303, '/dashboard');
	},

	reschedulePo: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		const expected_date = data.get('expected_date');
		if (!id) return fail(400, { error: 'Missing id' });
		if (!DATE_RE.test(expected_date)) return fail(400, { error: 'Invalid date' });
		await db.query('UPDATE purchase_orders SET expected_date = ? WHERE id = ?', [
			expected_date,
			id,
		]);
		redirect(303, '/dashboard');
	},

	rescheduleShipment: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		const ship_date = data.get('ship_date');
		if (!id) return fail(400, { error: 'Missing id' });
		if (!DATE_RE.test(ship_date)) return fail(400, { error: 'Invalid date' });
		await db.query('UPDATE shipments SET ship_date = ? WHERE id = ?', [ship_date, id]);
		redirect(303, '/dashboard');
	},
};
