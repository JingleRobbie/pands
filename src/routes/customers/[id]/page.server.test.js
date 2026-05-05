import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, getCustomer, updateCustomer } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
	getCustomer: vi.fn(),
	updateCustomer: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('$lib/services/customers.js', () => ({
	getCustomer,
	updateCustomer,
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	fail: vi.fn((status, data) => ({ status, data })),
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

describe('customer detail page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws not found when loading a missing customer', async () => {
		getCustomer.mockResolvedValueOnce(null);

		await expect(load({ params: { id: '12' } })).rejects.toEqual({
			type: 'error',
			status: 404,
			message: 'Customer not found',
		});

		expect(db.query).not.toHaveBeenCalled();
	});

	it('loads the customer and related work orders', async () => {
		const customer = { id: 12, name: 'Acme', phone: '555-0100' };
		const wos = [{ id: 42, so_number: 'SO-1', job_name: 'North Wing', status: 'OPEN' }];
		getCustomer.mockResolvedValueOnce(customer);
		db.query.mockResolvedValueOnce([wos]);

		const result = await load({ params: { id: '12' } });

		expect(result).toEqual({ customer, wos });
		expect(db.query).toHaveBeenCalledWith(
			'SELECT id, so_number, job_name, status FROM work_orders WHERE customer_id = ? ORDER BY created_at DESC',
			['12']
		);
	});

	it('requires a customer name before updating', async () => {
		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([
				['name', '   '],
				['phone', '555-0100'],
			]),
		});

		expect(result).toEqual({ status: 400, data: { error: 'Customer name is required' } });
		expect(updateCustomer).not.toHaveBeenCalled();
	});

	it('updates the customer and returns success', async () => {
		updateCustomer.mockResolvedValueOnce(undefined);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([
				['name', ' Acme '],
				['phone', ' 555-0100 '],
			]),
		});

		expect(result).toEqual({ success: true });
		expect(updateCustomer).toHaveBeenCalledWith('12', {
			name: 'Acme',
			phone: ' 555-0100 ',
		});
	});

	it('returns service errors when updating fails', async () => {
		updateCustomer.mockRejectedValueOnce(new Error('database unavailable'));

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([
				['name', 'Acme'],
				['phone', '555-0100'],
			]),
		});

		expect(result).toEqual({ status: 500, data: { error: 'database unavailable' } });
	});
});
