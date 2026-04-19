import { fail } from '@sveltejs/kit';

export function requireAdmin(locals) {
	if (locals.appUser?.role !== 'admin') {
		return fail(403, { error: 'Admin access required.' });
	}
	return null;
}
