import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: { query: vi.fn() },
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
}));

const { load } = await import('./+page.server.js');

describe('inventory count history load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects non-admin users before querying counts', async () => {
		await expect(load({ locals: { appUser: { id: 9, role: 'user' } } })).rejects.toEqual({
			type: 'error',
			status: 403,
			message: 'Admin only',
		});

		expect(db.query).not.toHaveBeenCalled();
	});

	it('loads count summaries for admin users', async () => {
		const counts = [
			{
				id: 44,
				memo: 'Cycle count',
				count_date: '2026-05-01',
				created_by_name: 'Alex',
				sku_count: 22,
			},
		];
		db.query.mockResolvedValueOnce([counts]);

		const result = await load({ locals: { appUser: { id: 9, role: 'admin' } } });

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain('FROM inventory_counts ic');
		expect(db.query.mock.calls[0][0]).toContain('COUNT(it.id) AS sku_count');
		expect(db.query.mock.calls[0][0]).toContain('ORDER BY ic.created_at DESC');
		expect(result).toEqual({ counts });
	});
});
