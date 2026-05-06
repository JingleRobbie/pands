import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, getAllCustomers } = vi.hoisted(() => ({
	db: { query: vi.fn() },
	getAllCustomers: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/services/customers.js', () => ({ getAllCustomers }));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	fail: vi.fn((status, data) => ({ status, data })),
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/wo/42${search}`);
}

describe('work order detail load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws 404 when the work order is missing', async () => {
		db.query.mockResolvedValueOnce([[undefined]]);

		await expect(
			load({
				params: { id: '42' },
				locals: { appUser: { id: 9 } },
				url: urlWithSearch(),
			})
		).rejects.toEqual({
			type: 'error',
			status: 404,
			message: 'Work order not found',
		});

		expect(getAllCustomers).not.toHaveBeenCalled();
	});

	it('loads work order detail data and creation flags', async () => {
		const wo = { id: 42, wo_number: 'WO-42', customer_display_name: 'Acme' };
		const lines = [{ id: 100, wo_id: 42, rolls_ordered: 10 }];
		const contacts = [{ id: 7, wo_id: 42, name: 'Dana' }];
		const customers = [{ id: 12, name: 'Acme' }];
		const user = { id: 9, name: 'Alex' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([lines])
			.mockResolvedValueOnce([contacts]);
		getAllCustomers.mockResolvedValueOnce(customers);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: user },
			url: urlWithSearch('?shipment_created=123&customer_created=1'),
		});

		expect(db.query).toHaveBeenCalledTimes(3);
		expect(db.query.mock.calls[0][1]).toEqual(['42']);
		expect(db.query.mock.calls[1][1]).toEqual(['42']);
		expect(db.query.mock.calls[2]).toEqual([
			'SELECT * FROM contacts WHERE wo_id = ? ORDER BY id',
			['42'],
		]);
		expect(getAllCustomers).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			wo,
			lines,
			contacts,
			customers,
			user,
			justCreatedShipmentId: 123,
			justCreatedCustomer: true,
		});
	});

	it('defaults creation flags when query params are absent or invalid', async () => {
		const wo = { id: 42, wo_number: 'WO-42' };
		db.query.mockResolvedValueOnce([[wo]]).mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch('?shipment_created=not-a-number'),
		});

		expect(result.justCreatedShipmentId).toBeNull();
		expect(result.justCreatedCustomer).toBe(false);
	});
});
