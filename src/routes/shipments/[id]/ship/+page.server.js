import { error, fail, redirect } from '@sveltejs/kit';
import { getShipment, confirmShipment } from '$lib/services/shipping.js';
import { safeReturnTo, withReturnTo } from '$lib/navigation.js';

export async function load({ params }) {
	const shipment = await getShipment(params.id);
	if (!shipment) error(404, 'Shipment not found');
	if (shipment.status !== 'DRAFT') error(400, 'Only DRAFT shipments can be confirmed');
	return { shipment };
}

export const actions = {
	default: async ({ params, request, locals }) => {
		const data = await request.formData();
		const returnTo = safeReturnTo(data.get('return_to'), '/shipments');

		const lineRolls = {};
		const invalidLines = [];
		for (const [key, value] of data.entries()) {
			if (key.startsWith('line_rolls_')) {
				const lineId = parseInt(key.replace('line_rolls_', ''));
				const rolls = parseInt(value);
				if (isNaN(rolls) || rolls < 1) {
					invalidLines.push(lineId);
				} else {
					lineRolls[lineId] = rolls;
				}
			}
		}
		if (invalidLines.length > 0) {
			return fail(400, { error: 'All roll counts must be at least 1.' });
		}
		if (Object.keys(lineRolls).length === 0) {
			return fail(400, { error: 'No roll lines found.' });
		}

		try {
			await confirmShipment(parseInt(params.id), lineRolls, locals.appUser.id);
		} catch (err) {
			return fail(500, { error: err.message });
		}
		redirect(303, withReturnTo(`/shipments/${params.id}?shipped=1`, returnTo));
	},
};
