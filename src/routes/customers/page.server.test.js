import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllCustomers } = vi.hoisted(() => ({
	getAllCustomers: vi.fn(),
}));

vi.mock('$lib/services/customers.js', () => ({
	getAllCustomers,
}));

const { load } = await import('./+page.server.js');

describe('customer list load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads all customers from the customer service', async () => {
		const customers = [
			{ id: 1, name: 'Acme' },
			{ id: 2, name: 'Beta' },
		];
		getAllCustomers.mockResolvedValueOnce(customers);

		const result = await load();

		expect(getAllCustomers).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ customers });
	});
});
