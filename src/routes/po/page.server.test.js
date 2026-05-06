import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: { query: vi.fn() },
}));

vi.mock('$lib/db.js', () => ({ db }));

const { load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/po${search}`);
}

describe('purchase order list load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-05T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('defaults to overdue and upcoming purchase orders with line summaries attached', async () => {
		const overdue = [{ id: 1, po_number: 'PO-1' }];
		const upcoming = [{ id: 2, po_number: 'PO-2' }];
		db.query
			.mockResolvedValueOnce([overdue])
			.mockResolvedValueOnce([upcoming])
			.mockResolvedValueOnce([
				[
					{ po_id: 1, sku_code: '3048', sqft_ordered: 100 },
					{ po_id: 1, sku_code: '4048', sqft_ordered: 50 },
				],
			])
			.mockResolvedValueOnce([[]]);

		const result = await load({
			url: urlWithSearch(),
			locals: { appUser: { id: 9, name: 'Alex' } },
		});

		expect(db.query).toHaveBeenCalledTimes(4);
		expect(db.query.mock.calls[0][0]).toContain('po.expected_date < ?');
		expect(db.query.mock.calls[0][1]).toEqual(['2026-05-05']);
		expect(db.query.mock.calls[1][0]).toContain('po.expected_date >= ?');
		expect(db.query.mock.calls[1][1]).toEqual(['2026-05-05']);
		expect(db.query.mock.calls[2][0]).toContain('WHERE pol.po_id IN (?)');
		expect(db.query.mock.calls[2][1]).toEqual([1]);
		expect(db.query.mock.calls[3][1]).toEqual([2]);
		expect(result).toEqual({
			overdue: [
				{
					id: 1,
					po_number: 'PO-1',
					lines: [
						{ sku_code: '3048', sqft_ordered: 100 },
						{ sku_code: '4048', sqft_ordered: 50 },
					],
				},
			],
			upcoming: [{ id: 2, po_number: 'PO-2', lines: [] }],
			searchResults: null,
			q: '',
			status: '',
			user: { id: 9, name: 'Alex' },
		});
	});

	it('loads filtered search results with normalized status, from date, and query text', async () => {
		const searchResults = [{ id: 3, po_number: 'PO-3' }];
		db.query
			.mockResolvedValueOnce([searchResults])
			.mockResolvedValueOnce([[{ po_id: 3, sku_code: '5048', sqft_ordered: 75 }]]);

		const result = await load({
			url: urlWithSearch('?q=%20Acme%20&status=received&from=not-a-date'),
			locals: { appUser: { id: 10, name: 'Sam' } },
		});

		expect(db.query).toHaveBeenCalledTimes(2);
		expect(db.query.mock.calls[0][0]).toContain('po.status = ?');
		expect(db.query.mock.calls[0][0]).toContain(
			'WHEN po.status = \'RECEIVED\' THEN COALESCE(recv.received_at, po.expected_date)'
		);
		expect(db.query.mock.calls[0][0]).toContain('(po.po_number LIKE ? OR po.vendor_name LIKE ?)');
		expect(db.query.mock.calls[0][1]).toEqual(['RECEIVED', '2026-02-04', '%Acme%', '%Acme%']);
		expect(db.query.mock.calls[1][1]).toEqual([3]);
		expect(result).toEqual({
			upcoming: [],
			searchResults: [
				{
					id: 3,
					po_number: 'PO-3',
					lines: [{ sku_code: '5048', sqft_ordered: 75 }],
				},
			],
			q: 'Acme',
			status: 'received',
			from: '2026-02-04',
			user: { id: 10, name: 'Sam' },
		});
	});
});
