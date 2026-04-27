import { db } from '$lib/db.js';
import { json } from '@sveltejs/kit';

function rowToDate(val) {
	return val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
}

export async function GET({ url }) {
	const start = url.searchParams.get('start');
	const end = url.searchParams.get('end');
	const pastDrafts = url.searchParams.get('past_drafts') === '1';
	if (!start || !end) return json({});

	const [rows] = await db.query(
		`SELECT s.id, s.shipment_number, s.ship_date, s.status,
		        wo.so_number, wo.customer_name, wo.job_name
		 FROM shipments s
		 JOIN work_orders wo ON wo.id = s.wo_id
		 WHERE s.ship_date BETWEEN ? AND ?
		 ORDER BY s.ship_date, s.shipment_number`,
		[start, end]
	);

	let allRows = rows;

	if (pastDrafts) {
		const [draftRows] = await db.query(
			`SELECT s.id, s.shipment_number, s.ship_date, s.status,
			        wo.so_number, wo.customer_name, wo.job_name
			 FROM shipments s
			 JOIN work_orders wo ON wo.id = s.wo_id
			 WHERE s.ship_date < ? AND s.status != 'SHIPPED'
			 ORDER BY s.ship_date, s.shipment_number`,
			[start]
		);
		allRows = [...draftRows, ...rows];
	}

	const byDate = {};
	for (const row of allRows) {
		const d = rowToDate(row.ship_date);
		(byDate[d] ??= []).push({
			id: row.id,
			shipment_number: row.shipment_number,
			status: row.status,
			so_number: row.so_number,
			customer_name: row.customer_name,
			job_name: row.job_name,
		});
	}

	return json(byDate);
}
