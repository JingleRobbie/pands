import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: { query: vi.fn() },
}));

vi.mock('$lib/db.js', () => ({ db }));

const { load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/wo${search}`);
}

describe('work order list load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-05T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('defaults to open work orders without a from date', async () => {
		const wos = [{ id: 1, so_number: 'SO-1', status: 'OPEN' }];
		db.query.mockResolvedValueOnce([wos]);

		const result = await load({
			locals: { appUser: { id: 9, name: 'Alex' } },
			url: urlWithSearch(),
		});

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain("wo.status = 'OPEN'");
		expect(db.query.mock.calls[0][1]).toEqual([]);
		expect(result).toEqual({
			wos,
			user: { id: 9, name: 'Alex' },
			status: 'open',
			from: '',
		});
	});

	it('loads complete work orders from a requested date', async () => {
		const wos = [{ id: 2, so_number: 'SO-2', status: 'COMPLETE' }];
		db.query.mockResolvedValueOnce([wos]);

		const result = await load({
			locals: { appUser: { id: 10 } },
			url: urlWithSearch('?status=complete&from=2026-04-01'),
		});

		expect(db.query.mock.calls[0][0]).toContain("wo.status = 'COMPLETE'");
		expect(db.query.mock.calls[0][0]).toContain(
			'COALESCE(activity.completed_at, wo.ship_date) >= ?'
		);
		expect(db.query.mock.calls[0][1]).toEqual(['2026-04-01']);
		expect(result).toEqual({
			wos,
			user: { id: 10 },
			status: 'complete',
			from: '2026-04-01',
		});
	});

	it('defaults all historical work orders to 90 days back when from is invalid', async () => {
		const wos = [];
		db.query.mockResolvedValueOnce([wos]);

		const result = await load({
			locals: { appUser: { id: 11 } },
			url: urlWithSearch('?status=all&from=not-a-date'),
		});

		expect(db.query.mock.calls[0][0]).not.toContain("WHERE wo.status = 'OPEN'");
		expect(db.query.mock.calls[0][0]).not.toContain("WHERE wo.status = 'COMPLETE'");
		expect(db.query.mock.calls[0][0]).toContain('WHERE CASE');
		expect(db.query.mock.calls[0][1]).toEqual(['2026-02-04']);
		expect(result).toEqual({
			wos,
			user: { id: 11 },
			status: 'all',
			from: '2026-02-04',
		});
	});

	it('falls back to open work orders for unknown statuses', async () => {
		const wos = [];
		db.query.mockResolvedValueOnce([wos]);

		const result = await load({
			locals: { appUser: { id: 12 } },
			url: urlWithSearch('?status=cancelled&from=2026-04-01'),
		});

		expect(db.query.mock.calls[0][0]).toContain("wo.status = 'OPEN'");
		expect(db.query.mock.calls[0][1]).toEqual([]);
		expect(result).toEqual({ wos, user: { id: 12 }, status: 'open', from: '' });
	});
});
