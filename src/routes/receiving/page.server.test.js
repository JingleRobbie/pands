import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: { query: vi.fn() },
}));

vi.mock('$lib/db.js', () => ({ db }));

const { load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/receiving${search}`);
}

describe('receiving load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-05T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('defaults to open purchase orders split into overdue and upcoming groups', async () => {
		const overdue = [{ id: 1, po_number: 'PO-1' }];
		const upcoming = [{ id: 2, po_number: 'PO-2' }];
		db.query.mockResolvedValueOnce([overdue]).mockResolvedValueOnce([upcoming]);

		const result = await load({ url: urlWithSearch() });

		expect(db.query).toHaveBeenCalledTimes(2);
		expect(db.query.mock.calls[0][0]).toContain('po.expected_date < ?');
		expect(db.query.mock.calls[0][1]).toEqual(['2026-05-05']);
		expect(db.query.mock.calls[1][0]).toContain('po.expected_date >= ?');
		expect(db.query.mock.calls[1][1]).toEqual(['2026-05-05']);
		expect(result).toEqual({ status: 'open', from: '', overdue, upcoming, pos: [] });
	});

	it('loads received purchase orders from a requested date', async () => {
		const pos = [{ id: 3, po_number: 'PO-3', status: 'RECEIVED' }];
		db.query.mockResolvedValueOnce([pos]);

		const result = await load({
			url: urlWithSearch('?status=received&from=2026-04-01'),
		});

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain("po.status = 'RECEIVED'");
		expect(db.query.mock.calls[0][0]).toContain(
			'COALESCE(receipts.received_at, po.expected_date) >= ?'
		);
		expect(db.query.mock.calls[0][1]).toEqual(['2026-04-01']);
		expect(result).toEqual({
			status: 'received',
			from: '2026-04-01',
			overdue: [],
			upcoming: [],
			pos,
		});
	});

	it('defaults all historical purchase orders to 90 days back when from is invalid', async () => {
		const pos = [];
		db.query.mockResolvedValueOnce([pos]);

		const result = await load({ url: urlWithSearch('?status=all&from=not-a-date') });

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain('CASE');
		expect(db.query.mock.calls[0][1]).toEqual(['2026-02-04']);
		expect(result).toEqual({
			status: 'all',
			from: '2026-02-04',
			overdue: [],
			upcoming: [],
			pos,
		});
	});

	it('falls back to open when the requested status is unknown', async () => {
		db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

		const result = await load({
			url: urlWithSearch('?status=cancelled&from=2026-04-01'),
		});

		expect(db.query).toHaveBeenCalledTimes(2);
		expect(result).toEqual({ status: 'open', from: '', overdue: [], upcoming: [], pos: [] });
	});
});
