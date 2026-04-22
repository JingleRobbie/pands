import { error } from '@sveltejs/kit';
import { getShipment } from '$lib/services/shipping.js';

export async function load({ params }) {
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');

	// Aggregate lines by SKU
	const skuMap = new Map();
	for (const line of shipment.lines) {
		if (!skuMap.has(line.sku_id)) {
			skuMap.set(line.sku_id, { display_label: line.display_label, sqft: 0 });
		}
		skuMap.get(line.sku_id).sqft += line.sqft;
	}
	const skuLines = [...skuMap.values()];

	return { shipment, skuLines };
}
