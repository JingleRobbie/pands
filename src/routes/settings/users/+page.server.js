import { db } from '$lib/db.js';
import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';

export async function load({ locals }) {
	if (locals.appUser?.role !== 'admin') redirect(302, '/settings');
	const [users] = await db.query(
		'SELECT id, display_name, role, is_active FROM app_users ORDER BY display_name'
	);
	return { users, appUser: locals.appUser };
}

export const actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const display_name = data.get('display_name')?.trim();
		const role = data.get('role');
		const password = data.get('password');

		// TODO(human): validate inputs — return fail(400, { createError: '...' }) if:
		// - display_name is empty
		// - role is not 'admin' or 'operator'
		// - password is empty
		if (!display_name) return fail(400, { createError: 'Name is required.' });
		if (!['admin', 'operator'].includes(role))
			return fail(400, { createError: 'Invalid role.' });
		if (!password) return fail(400, { createError: 'Password is required.' });

		const hash = await bcrypt.hash(password, 12);
		try {
			await db.query(
				'INSERT INTO app_users (display_name, role, password_hash) VALUES (?, ?, ?)',
				[display_name, role, hash]
			);
		} catch (err) {
			if (err.code === 'ER_DUP_ENTRY') {
				return fail(400, { createError: 'A user with that name already exists.' });
			}
			return fail(500, { createError: err.message });
		}
		return { created: true };
	},

	update: async ({ request, locals }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		const display_name = data.get('display_name')?.trim();
		const role = data.get('role');
		const is_active = data.has('is_active') ? 1 : 0;

		if (!display_name) return fail(400, { updateError: 'Name is required.', updateId: id });
		if (!['admin', 'operator'].includes(role))
			return fail(400, { updateError: 'Invalid role.', updateId: id });
		if (id === locals.appUser.id && !is_active)
			return fail(400, {
				updateError: 'You cannot deactivate your own account.',
				updateId: id,
			});

		await db.query('UPDATE app_users SET display_name=?, role=?, is_active=? WHERE id=?', [
			display_name,
			role,
			is_active,
			id,
		]);
		return { updated: true, updatedId: id };
	},

	set_password: async ({ request }) => {
		const data = await request.formData();
		const id = parseInt(data.get('id'));
		const password = data.get('password');

		if (!password) return fail(400, { pwError: 'Password is required.', pwId: id });

		const hash = await bcrypt.hash(password, 12);
		await db.query('UPDATE app_users SET password_hash=? WHERE id=?', [hash, id]);
		return { passwordReset: true, pwId: id };
	},
};
