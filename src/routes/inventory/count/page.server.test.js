import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, getCountBalancesAsOf, createCountBatch } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
	getCountBalancesAsOf: vi.fn(),
	createCountBatch: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/services/inventory.js', () => ({ getCountBalancesAsOf, createCountBatch }));

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

describe('inventory count actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects non-admin preview requests', async () => {
		await expect(
			actions.preview({
				request: requestWithForm([]),
				locals: { appUser: { id: 9, role: 'user' } },
			})
		).rejects.toEqual({ type: 'error', status: 403, message: 'Admin only' });

		expect(db.query).not.toHaveBeenCalled();
	});

	it('builds a preview from entered counts that differ from current balances', async () => {
		db.query.mockResolvedValueOnce([
			[
				{ id: 1, display_label: '3x48' },
				{ id: 2, display_label: '4x48' },
			],
		]);
		getCountBalancesAsOf.mockResolvedValueOnce({ 1: 100, 2: 50 });

		const result = await actions.preview({
			request: requestWithForm([
				['memo', 'Cycle count'],
				['count_date', '2026-05-01'],
				['count_1', '125'],
				['count_2', '50'],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({
			preview: [
				{
					skuId: 1,
					label: '3x48',
					currentBalance: 100,
					newCount: 125,
					delta: 25,
				},
			],
			memo: 'Cycle count',
			countDate: '2026-05-01',
		});
		expect(getCountBalancesAsOf).toHaveBeenCalledWith('2026-05-01');
	});

	it('returns a validation failure when preview finds no changes', async () => {
		db.query.mockResolvedValueOnce([[{ id: 1, display_label: '3x48' }]]);
		getCountBalancesAsOf.mockResolvedValueOnce({ 1: 100 });

		const result = await actions.preview({
			request: requestWithForm([
				['count_date', '2026-05-01'],
				['count_1', '100'],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({
			status: 400,
			data: {
				error: expect.stringContaining('No changes detected'),
			},
		});
	});

	it('returns previous count entries from the back action', async () => {
		const result = await actions.back({
			request: requestWithForm([
				['memo', 'Cycle count'],
				['count_date', '2026-05-01'],
				['sku_id', '1'],
				['sku_id', '2'],
				['new_count', '125'],
				['new_count', '50'],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({
			back: true,
			counts: { 1: 125, 2: 50 },
			memo: 'Cycle count',
			countDate: '2026-05-01',
		});
	});

	it('rejects empty commit requests before calling the service', async () => {
		const result = await actions.commit({
			request: requestWithForm([['count_date', '2026-05-01']]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'No adjustments to commit.' } });
		expect(createCountBatch).not.toHaveBeenCalled();
	});

	it('commits count adjustments and redirects to count history', async () => {
		createCountBatch.mockResolvedValueOnce();

		await expect(
			actions.commit({
				request: requestWithForm([
					['memo', 'Cycle count'],
					['count_date', '2026-05-01'],
					['sku_id', '1'],
					['sku_id', '2'],
					['delta', '25'],
					['delta', '-5'],
					['new_count', '125'],
					['new_count', '45'],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/inventory/counts',
		});

		expect(createCountBatch).toHaveBeenCalledWith(
			[
				{ skuId: 1, delta: 25, newCount: 125 },
				{ skuId: 2, delta: -5, newCount: 45 },
			],
			'Cycle count',
			'2026-05-01',
			9
		);
	});

	it('returns a user-facing failure when count commit is rejected', async () => {
		createCountBatch.mockRejectedValueOnce(new Error('Database unavailable'));

		const result = await actions.commit({
			request: requestWithForm([
				['count_date', '2026-05-01'],
				['sku_id', '1'],
				['delta', '25'],
				['new_count', '125'],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ status: 500, data: { error: 'Database unavailable' } });
	});
});
