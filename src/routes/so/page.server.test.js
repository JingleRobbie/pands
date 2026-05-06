import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: { query: vi.fn() },
}));

vi.mock('$lib/db.js', () => ({ db }));

const { load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/so${search}`);
}

describe('sales order list load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('defaults to open and in-progress sales orders', async () => {
		const sos = [{ id: 1, so_number: 'SO-1', status: 'OPEN' }];
		db.query.mockResolvedValueOnce([sos]);

		const result = await load({ url: urlWithSearch() });

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain("so.status IN ('OPEN','IN_PROGRESS')");
		expect(db.query.mock.calls[0][0]).toContain('ORDER BY so.ship_date, so.so_number');
		expect(db.query.mock.calls[0][1]).toBeUndefined();
		expect(result).toEqual({ sos, searchResults: null, q: '', status: '' });
	});

	it('loads filtered search results with normalized status and trimmed query text', async () => {
		const searchResults = [{ id: 2, so_number: 'SO-2', status: 'COMPLETED' }];
		db.query.mockResolvedValueOnce([searchResults]);

		const result = await load({
			url: urlWithSearch('?q=%20Acme%20&status=completed'),
		});

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain('so.status = ?');
		expect(db.query.mock.calls[0][0]).toContain(
			'(so.so_number LIKE ? OR so.customer_name LIKE ? OR so.job_name LIKE ?)'
		);
		expect(db.query.mock.calls[0][1]).toEqual(['COMPLETED', '%Acme%', '%Acme%', '%Acme%']);
		expect(result).toEqual({
			sos: [],
			searchResults,
			q: 'Acme',
			status: 'completed',
		});
	});

	it('does not add a status predicate for all-status searches', async () => {
		const searchResults = [{ id: 3, so_number: 'SO-3' }];
		db.query.mockResolvedValueOnce([searchResults]);

		const result = await load({ url: urlWithSearch('?status=all') });

		expect(db.query.mock.calls[0][0]).not.toContain('so.status = ?');
		expect(db.query.mock.calls[0][1]).toEqual([]);
		expect(result).toEqual({ sos: [], searchResults, q: '', status: 'all' });
	});
});
