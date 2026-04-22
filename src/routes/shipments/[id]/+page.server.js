import { error, fail } from '@sveltejs/kit';
import { getShipment, markShipped } from '$lib/services/shipping.js';

export async function load({ params }) {
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');
	return { shipment };
}

export const actions = {
	markShipped: async ({ params }) => {
		try {
			await markShipped(params.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		return { shipped: true };
	},
};
