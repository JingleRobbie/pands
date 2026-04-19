import { db } from '$lib/db.js';
import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';

export async function load({ locals }) {
	if (locals.appUser) redirect(302, '/calendar');
	const [users] = await db.query(
		'SELECT id, display_name FROM app_users WHERE is_active = TRUE ORDER BY display_name'
	);
	return { users };
}

export const actions = {
	default: async ({ request, cookies, locals }) => {
		if (locals.appUser) redirect(302, '/calendar');
		const data = await request.formData();
		const userId = parseInt(data.get('user_id'));
		const password = data.get('password');
		if (!userId) return fail(400, { error: 'Please select a user.' });

		const [[user]] = await db.query(
			'SELECT id, password_hash FROM app_users WHERE id = ? AND is_active = TRUE',
			[userId]
		);

		if (!user.password_hash) return fail(401, { error: 'Invalid credentials.' });
		const isMatch = await bcrypt.compare(password, user.password_hash);
		if (!isMatch) return fail(401, { error: 'Invalid credentials.' });

		cookies.set('app_user_id', String(userId), {
			path: '/',
			maxAge: 60 * 60 * 24 * 30,
			httpOnly: true,
			sameSite: 'lax',
		});
		redirect(303, '/calendar');
	},
};
