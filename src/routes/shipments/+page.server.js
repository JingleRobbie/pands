import { getAllShipments } from '$lib/services/shipping.js';

export async function load() {
	const shipments = await getAllShipments();
	return { shipments };
}
