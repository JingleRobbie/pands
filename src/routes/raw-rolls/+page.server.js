import { db } from '$lib/db.js';

export async function load() {
	const [rolls] = await db.query(
		'SELECT id, vendor, r_value, thickness_in, width_in, roll_length_ft, pebs FROM raw_roll_lookup ORDER BY thickness_in, width_in, vendor'
	);
	return { rolls };
}
