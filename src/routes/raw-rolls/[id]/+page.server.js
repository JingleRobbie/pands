import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params, locals }) {
	if (locals.appUser?.role !== 'admin') redirect(302, '/raw-rolls');
	const id = parseInt(params.id);
	if (!id) error(404, 'Record not found');
	const [[roll]] = await db.query(
		'SELECT id, vendor, r_value, thickness_in, width_in, roll_length_ft, pebs FROM raw_roll_lookup WHERE id = ?',
		[id]
	);
	if (!roll) error(404, 'Record not found');
	return { roll };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		if (locals.appUser?.role !== 'admin') redirect(302, '/raw-rolls');
		const id = parseInt(params.id);
		const data = await request.formData();
		const vendor = data.get('vendor');
		const r_value = data.get('r_value')?.trim() || null;
		const thickness_in = parseFloat(data.get('thickness_in'));
		const width_in = parseInt(data.get('width_in'));
		const roll_length_ft = parseInt(data.get('roll_length_ft'));
		const pebs = data.has('pebs') ? 1 : 0;

		const vendors = ['Johns Manville', 'Certainteed'];
		if (!vendors.includes(vendor)) return fail(400, { error: 'Invalid vendor.' });
		if (isNaN(thickness_in) || thickness_in <= 0) return fail(400, { error: 'Valid thickness required.' });
		if (isNaN(width_in) || width_in <= 0) return fail(400, { error: 'Valid width required.' });
		if (isNaN(roll_length_ft) || roll_length_ft <= 0) return fail(400, { error: 'Valid roll length required.' });

		try {
			await db.query(
				'UPDATE raw_roll_lookup SET vendor=?, r_value=?, thickness_in=?, width_in=?, roll_length_ft=?, pebs=? WHERE id=?',
				[vendor, r_value, thickness_in, width_in, roll_length_ft, pebs, id]
			);
		} catch (err) {
			if (err.code === 'ER_DUP_ENTRY') return fail(400, { error: 'A record for that vendor/thickness/width already exists.' });
			return fail(500, { error: err.message });
		}
		return { success: true };
	},
};
