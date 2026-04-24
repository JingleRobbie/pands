import { error } from '@sveltejs/kit';
import { getShipment } from '$lib/services/shipping.js';

export async function load({ params, url }) {
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');
	return {
		shipment,
		justCreated: url.searchParams.get('created') === '1',
		justShipped: url.searchParams.get('shipped') === '1',
	};
}
