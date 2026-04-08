import { db } from '$lib/db.js';
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (locals.appUser) redirect(302, '/matrix');
	const [users] = await db.query('SELECT id, display_name FROM app_users WHERE is_active = TRUE ORDER BY display_name');
	return { users };
}

export const actions = {
	default: async ({ request, cookies, locals }) => {
		if (locals.appUser) redirect(302, '/matrix');
		const data = await request.formData();
		const userId = data.get('user_id');
		if (userId) {
			cookies.set('app_user_id', userId, {
				path: '/',
				maxAge: 60 * 60 * 24 * 30, // 30 days
				httpOnly: true,
				sameSite: 'lax',
			});
		}
		redirect(303, '/matrix');
	},
};
