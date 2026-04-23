import { error, fail, redirect } from '@sveltejs/kit';
import { getShipment, confirmShipment } from '$lib/services/shipping.js';

export async function load({ params }) {
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');
	if (shipment.status !== 'DRAFT') error(400, 'Only DRAFT shipments can be confirmed');
	return { shipment };
}

export const actions = {
	default: async ({ params, request, locals }) => {
		const data = await request.formData();

		const lineRolls = {};
		for (const [key, val] of data.entries()) {
			const m = key.match(/^line_rolls_(\d+)$/);
			if (m) {
				const v = parseInt(val);
				if (v > 0) lineRolls[parseInt(m[1])] = v;
			}
		}

		try {
			await confirmShipment(parseInt(params.id), lineRolls, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, `/shipments/${params.id}`);
	},
};
