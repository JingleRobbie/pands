import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateShipment } = vi.hoisted(() => ({
	updateShipment: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db: { query: vi.fn() } }));
vi.mock('$lib/services/shipping.js', () => ({
	getShipment: vi.fn(),
	updateShipment,
}));

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

describe('shipment edit action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('updates shipment lines, added runs, ship date, and redirects with returnTo', async () => {
		updateShipment.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '123' },
				request: requestWithForm([
					['return_to', '/shipments?status=draft'],
					['ship_date', '2026-05-01'],
					['remove_line', '15'],
					['remove_line', '16'],
					['line_rolls_17', '2'],
					['line_rolls_18', '0'],
					['add_run_ids', '77'],
					['add_run_ids', '78'],
					['add_rolls_77', '3'],
					['add_rolls_78', '0'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/shipments/123?returnTo=%2Fshipments%3Fstatus%3Ddraft',
		});

		expect(updateShipment).toHaveBeenCalledWith(
			123,
			{
				removeLineIds: [15, 16],
				lineRolls: { 17: 2 },
				addRunIds: [77, 78],
				addRollsMap: { 77: 3 },
				shipDate: '2026-05-01',
			},
			9
		);
	});

	it('passes null ship date when the edit form does not include one', async () => {
		updateShipment.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '123' },
				request: requestWithForm([['return_to', '/shipments']]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/shipments/123?returnTo=%2Fshipments',
		});

		expect(updateShipment).toHaveBeenCalledWith(
			123,
			{
				removeLineIds: [],
				lineRolls: {},
				addRunIds: [],
				addRollsMap: {},
				shipDate: null,
			},
			9
		);
	});

	it('returns a user-facing failure when the service rejects the update', async () => {
		updateShipment.mockRejectedValueOnce(new Error('Cannot ship 6 rolls - only 5 rolls are available.'));

		const result = await actions.default({
			params: { id: '123' },
			request: requestWithForm([
				['return_to', '/shipments'],
				['line_rolls_17', '6'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 500,
			data: { error: 'Cannot ship 6 rolls - only 5 rolls are available.' },
		});
	});

	it('falls back to shipments when return_to is unsafe', async () => {
		updateShipment.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '123' },
				request: requestWithForm([['return_to', 'https://example.com']]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/shipments/123?returnTo=%2Fshipments',
		});
	});
});
