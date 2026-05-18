import { db } from '$lib/db.js';
import { fail, redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (locals.appUser?.role !== 'admin') redirect(302, '/raw-rolls');
}

export const actions = {
	default: async ({ request, locals }) => {
		if (locals.appUser?.role !== 'admin') redirect(302, '/raw-rolls');
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
				'INSERT INTO raw_roll_lookup (vendor, r_value, thickness_in, width_in, roll_length_ft, pebs) VALUES (?, ?, ?, ?, ?, ?)',
				[vendor, r_value, thickness_in, width_in, roll_length_ft, pebs]
			);
		} catch (err) {
			if (err.code === 'ER_DUP_ENTRY') return fail(400, { error: 'A record for that vendor/thickness/width already exists.' });
			return fail(500, { error: err.message });
		}
		redirect(303, '/raw-rolls?created=1');
	},
};
