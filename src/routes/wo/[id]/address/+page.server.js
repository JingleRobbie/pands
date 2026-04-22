import { fail, redirect, error } from '@sveltejs/kit';
import { db } from '$lib/db.js';

export async function load({ params }) {
	const [[wo]] = await db.query(
		`SELECT wo.id, wo.so_number, wo.job_name, wo.customer_id,
		        wo.ship_to_name, wo.ship_addr1, wo.ship_addr2,
		        wo.ship_city, wo.ship_state, wo.ship_zip,
		        c.name AS customer_name
		 FROM work_orders wo
		 LEFT JOIN customers c ON c.id = wo.customer_id
		 WHERE wo.id = ?`,
		[params.id]
	);
	if (!wo) error(404, 'Work order not found');

	let savedAddresses = [];
	if (wo.customer_id) {
		[savedAddresses] = await db.query(
			'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY nickname',
			[wo.customer_id]
		);
	}

	return { wo, savedAddresses };
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const ship_to_name = data.get('ship_to_name')?.trim() || null;
		const addr1 = data.get('ship_addr1')?.trim() || null;
		const addr2 = data.get('ship_addr2')?.trim() || null;
		const city = data.get('ship_city')?.trim() || null;
		const state = data.get('ship_state')?.trim() || null;
		const zip = data.get('ship_zip')?.trim() || null;
		const saveToBook = data.get('save_to_book') === 'on';
		const nickname = data.get('nickname')?.trim() || null;

		await db.query(
			`UPDATE work_orders
			 SET ship_to_name=?, ship_addr1=?, ship_addr2=?, ship_city=?, ship_state=?, ship_zip=?
			 WHERE id=?`,
			[ship_to_name, addr1, addr2, city, state, zip, params.id]
		);

		if (saveToBook && nickname) {
			const [[wo]] = await db.query('SELECT customer_id FROM work_orders WHERE id = ?', [
				params.id,
			]);
			if (wo?.customer_id) {
				await db.query(
					`INSERT INTO customer_addresses (customer_id, nickname, ship_to_name, addr1, addr2, city, state, zip)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[wo.customer_id, nickname, ship_to_name, addr1, addr2, city, state, zip]
				);
			}
		}

		redirect(303, `/wo/${params.id}`);
	},
};
