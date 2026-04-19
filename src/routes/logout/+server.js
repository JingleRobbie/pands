import { redirect } from '@sveltejs/kit';

export function GET({ cookies }) {
	cookies.delete('app_user_id', { path: '/' });
	redirect(302, '/calendar');
}
