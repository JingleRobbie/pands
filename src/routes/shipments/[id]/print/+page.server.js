import { error } from '@sveltejs/kit';
import { getShipment } from '$lib/services/shipping.js';

export async function load({ params, locals }) {
	if (!locals.appUser) error(401, 'Unauthorized');
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');
	return { shipment };
}
