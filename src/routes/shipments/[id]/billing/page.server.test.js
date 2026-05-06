import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getShipment } = vi.hoisted(() => ({
	getShipment: vi.fn(),
}));

vi.mock('$lib/services/shipping.js', () => ({
	getShipment,
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
}));

const { load } = await import('./+page.server.js');

describe('shipment billing load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws 404 when the shipment is missing', async () => {
		getShipment.mockResolvedValueOnce(null);

		await expect(load({ params: { id: '123' } })).rejects.toEqual({
			type: 'error',
			status: 404,
			message: 'Shipment not found',
		});

		expect(getShipment).toHaveBeenCalledWith('123');
	});

	it('aggregates shipment lines by SKU for billing', async () => {
		const shipment = {
			id: 123,
			lines: [
				{ sku_id: 10, display_label: '3 x 48', sqft: 100 },
				{ sku_id: 11, display_label: '4 x 48', sqft: 60 },
				{ sku_id: 10, display_label: '3 x 48', sqft: 40 },
			],
		};
		getShipment.mockResolvedValueOnce(shipment);

		const result = await load({ params: { id: '123' } });

		expect(result).toEqual({
			shipment,
			skuLines: [
				{ display_label: '3 x 48', sqft: 140 },
				{ display_label: '4 x 48', sqft: 60 },
			],
		});
	});
});
