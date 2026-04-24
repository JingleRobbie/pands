import { json, error } from '@sveltejs/kit';
import { getCountBalancesAsOf } from '$lib/services/inventory.js';
import { localDate } from '$lib/utils.js';

export async function GET({ url, locals }) {
	if (locals.appUser?.role !== 'admin') error(403, 'Admin only');
	const today = localDate();
	const date = url.searchParams.get('date') || today;
	const safeDate = date > today ? today : date;
	const balances = await getCountBalancesAsOf(safeDate);
	return json({ balances });
}
