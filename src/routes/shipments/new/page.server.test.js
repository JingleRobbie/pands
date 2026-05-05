import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createShipment } = vi.hoisted(() => ({
	createShipment: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db: { query: vi.fn() } }));
vi.mock('$lib/services/shipping.js', () => ({ createShipment }));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	fail: vi.fn((status, data) => ({ status, data })),
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { actions } = await import('./+page.server.js');

function requestWithForm(entries) {
	return {
		formData: async () => {
			const data = new FormData();
			for (const [key, value] of entries) {
				data.append(key, value);
			}
			return data;
		},
	};
}

describe('new shipment action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('requires a ship date before calling the service', async () => {
		const result = await actions.default({
			request: requestWithForm([
				['wo_id', '22'],
				['customer_id', '5'],
				['run_ids', '77'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Ship date is required.' } });
		expect(createShipment).not.toHaveBeenCalled();
	});

	it('requires at least one production run before calling the service', async () => {
		const result = await actions.default({
			request: requestWithForm([
				['wo_id', '22'],
				['customer_id', '5'],
				['ship_date', '2026-05-01'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Select at least one production run.' },
		});
		expect(createShipment).not.toHaveBeenCalled();
	});

	it('creates a shipment with selected runs and positive partial-roll entries', async () => {
		createShipment.mockResolvedValueOnce({ shipmentId: 123 });

		await expect(
			actions.default({
				request: requestWithForm([
					['wo_id', '22'],
					['customer_id', '5'],
					['ship_date', '2026-05-01'],
					['run_ids', '77'],
					['run_ids', '78'],
					['rolls_to_ship_77', '2'],
					['rolls_to_ship_78', '0'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/wo/22?shipment_created=123',
		});

		expect(createShipment).toHaveBeenCalledWith(
			22,
			5,
			'2026-05-01',
			[77, 78],
			9,
			{ 77: 2 }
		);
	});

	it('returns a user-facing failure when shipment creation is rejected', async () => {
		createShipment.mockRejectedValueOnce(
			new Error('One or more selected runs are not completed or do not exist.')
		);

		const result = await actions.default({
			request: requestWithForm([
				['wo_id', '22'],
				['customer_id', '5'],
				['ship_date', '2026-05-01'],
				['run_ids', '77'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 500,
			data: { error: 'One or more selected runs are not completed or do not exist.' },
		});
	});
});
