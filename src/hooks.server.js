import { db } from '$lib/db.js';

export async function handle({ event, resolve }) {
	// Read app_user_id from cookie and attach user to locals
	const userId = event.cookies.get('app_user_id');
	if (userId) {
		try {
			const [[user]] = await db.query(
				'SELECT id, display_name, role, sidebar_collapsed FROM app_users WHERE id = ? AND is_active = TRUE',
				[userId]
			);
			event.locals.appUser = user ?? null;
		} catch {
			event.locals.appUser = null;
		}
	} else {
		event.locals.appUser = null;
	}

	const path = event.url.pathname;
	if (
		!event.locals.appUser &&
		path !== '/' &&
		path !== '/login' &&
		path !== '/calendar' &&
		path !== '/calendar/events' &&
		!path.startsWith('/static')
	) {
		return Response.redirect(new URL('/login', event.url), 302);
	}

	return resolve(event);
}
