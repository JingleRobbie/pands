import { error, fail, redirect } from '@sveltejs/kit';
import { getShipment, revertShipment } from '$lib/services/shipping.js';
import { requireAdmin } from '$lib/auth.js';
import { safeReturnTo, withReturnTo } from '$lib/navigation.js';

export async function load({ params, url, locals }) {
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');
	return {
		shipment,
		user: locals.appUser,
		justCreated: url.searchParams.get('created') === '1',
		justShipped: url.searchParams.get('shipped') === '1',
		justReverted: url.searchParams.get('reverted') === '1',
		fromWoId: parseInt(url.searchParams.get('wo')) || null,
	};
}

export const actions = {
	revert: async ({ request, params, locals }) => {
		const denied = requireAdmin(locals);
		if (denied) return denied;
		const data = await request.formData();
		const returnTo = safeReturnTo(data.get('return_to'), '/shipments');
		try {
			await revertShipment(params.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, withReturnTo(`/shipments/${params.id}?reverted=1`, returnTo));
	},
};
