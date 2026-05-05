import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createCustomer, db } = vi.hoisted(() => ({
	createCustomer: vi.fn(),
	db: {
		query: vi.fn(),
	},
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('$lib/services/customers.js', () => ({
	createCustomer,
}));

vi.mock('@sveltejs/kit', () => ({
	fail: vi.fn((status, data) => ({ status, data })),
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { actions, load } = await import('./+page.server.js');

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

describe('new customer page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads the optional work order id from the query string', async () => {
		const result = await load({
			url: new URL('http://pands.local/customers/new?wo=42'),
		});

		expect(result).toEqual({ woId: 42 });
	});

	it('requires a customer name and preserves the work order id', async () => {
		const result = await actions.default({
			request: requestWithForm([
				['name', '   '],
				['wo_id', '42'],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Customer name is required', woId: 42 },
		});
		expect(createCustomer).not.toHaveBeenCalled();
		expect(db.query).not.toHaveBeenCalled();
	});

	it('creates a customer and redirects to the customer list when no work order is attached', async () => {
		createCustomer.mockResolvedValueOnce(12);

		await expect(
			actions.default({
				request: requestWithForm([
					['name', ' Acme '],
					['phone', ' 555-0100 '],
					['wo_id', ''],
				]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/customers' });

		expect(createCustomer).toHaveBeenCalledWith({ name: 'Acme', phone: '555-0100' });
		expect(db.query).not.toHaveBeenCalled();
	});

	it('links the new customer to a work order and redirects back to that work order', async () => {
		createCustomer.mockResolvedValueOnce(12);
		db.query.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				request: requestWithForm([
					['name', 'Acme'],
					['phone', '555-0100'],
					['wo_id', '42'],
				]),
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/wo/42?customer_created=1',
		});

		expect(createCustomer).toHaveBeenCalledWith({ name: 'Acme', phone: '555-0100' });
		expect(db.query).toHaveBeenCalledWith('UPDATE work_orders SET customer_id = ? WHERE id = ?', [
			12,
			42,
		]);
	});

	it('returns service errors with the work order id preserved', async () => {
		createCustomer.mockRejectedValueOnce(new Error('database unavailable'));

		const result = await actions.default({
			request: requestWithForm([
				['name', 'Acme'],
				['phone', '555-0100'],
				['wo_id', '42'],
			]),
		});

		expect(result).toEqual({
			status: 500,
			data: { error: 'database unavailable', woId: 42 },
		});
	});
});
