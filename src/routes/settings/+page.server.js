import { db } from '$lib/db.js';
import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
	return { appUser: locals.appUser };
}

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const sidebarCollapsed = data.has('sidebar_collapsed') ? 1 : 0;
		await db.query('UPDATE app_users SET sidebar_collapsed = ? WHERE id = ?', [
			sidebarCollapsed,
			locals.appUser.id,
		]);
		redirect(303, '/matrix');
	},
};
