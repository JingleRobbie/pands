import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCountBalancesAsOf } = vi.hoisted(() => ({
	getCountBalancesAsOf: vi.fn(),
}));

vi.mock('$lib/services/inventory.js', () => ({
	getCountBalancesAsOf,
}));

vi.mock('$lib/utils.js', () => ({
	localDate: vi.fn(() => '2026-05-05'),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	json: vi.fn((data) => ({ json: data })),
}));

const { GET } = await import('./+server.js');

function urlWithParams(params = {}) {
	return new URL(
		`http://pands.local/inventory/count/balances?${new URLSearchParams(params)}`
	);
}

describe('inventory count balances endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects non-admin users', async () => {
		await expect(
			GET({
				locals: { appUser: { role: 'operator' } },
				url: urlWithParams(),
			})
		).rejects.toEqual({ type: 'error', status: 403, message: 'Admin only' });

		expect(getCountBalancesAsOf).not.toHaveBeenCalled();
	});

	it('returns balances as of today when no date is provided', async () => {
		const balances = { 1: 500, 2: 250 };
		getCountBalancesAsOf.mockResolvedValueOnce(balances);

		const result = await GET({
			locals: { appUser: { role: 'admin' } },
			url: urlWithParams(),
		});

		expect(result).toEqual({ json: { balances } });
		expect(getCountBalancesAsOf).toHaveBeenCalledWith('2026-05-05');
	});

	it('uses past requested dates directly', async () => {
		const balances = { 1: 100 };
		getCountBalancesAsOf.mockResolvedValueOnce(balances);

		const result = await GET({
			locals: { appUser: { role: 'admin' } },
			url: urlWithParams({ date: '2026-04-30' }),
		});

		expect(result).toEqual({ json: { balances } });
		expect(getCountBalancesAsOf).toHaveBeenCalledWith('2026-04-30');
	});

	it('clamps future requested dates to today', async () => {
		const balances = { 1: 500 };
		getCountBalancesAsOf.mockResolvedValueOnce(balances);

		const result = await GET({
			locals: { appUser: { role: 'admin' } },
			url: urlWithParams({ date: '2026-05-31' }),
		});

		expect(result).toEqual({ json: { balances } });
		expect(getCountBalancesAsOf).toHaveBeenCalledWith('2026-05-05');
	});
});
