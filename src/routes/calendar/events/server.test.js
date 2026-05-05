import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('@sveltejs/kit', () => ({
	json: vi.fn((data) => ({ json: data })),
}));

const { GET } = await import('./+server.js');

function urlWithParams(params) {
	return new URL(`http://pands.local/calendar/events?${new URLSearchParams(params)}`);
}

describe('calendar events endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('queries the requested month and groups PO and production events by date', async () => {
		db.query
			.mockResolvedValueOnce([
				[
					{
						po_id: 12,
						po_number: 'PO-1',
						vendor_name: 'Johns Manville',
						event_date: new Date('2026-05-05T12:00:00Z'),
					},
					{
						po_id: 12,
						po_number: 'PO-1',
						vendor_name: 'Johns Manville',
						event_date: new Date('2026-05-05T12:00:00Z'),
					},
				],
			])
			.mockResolvedValueOnce([
				[
					{
						wo_id: 44,
						event_date: '2026-05-06',
						so_number: 'SO-1',
						customer_name: 'Acme',
						job_name: 'North Wing',
					},
				],
			]);

		const result = await GET({
			url: urlWithParams({ year: '2026', month: '5' }),
		});

		expect(result).toEqual({
			json: {
				'2026-05-05': {
					12: { type: 'po', label: 'Johns Manville - PO-1' },
				},
				'2026-05-06': {
					44: { type: 'production', label: 'SO-1 Acme - North Wing' },
				},
			},
		});
		expect(db.query).toHaveBeenNthCalledWith(1, expect.any(String), [
			'2026-05-01',
			'2026-05-31',
		]);
		expect(db.query).toHaveBeenNthCalledWith(2, expect.any(String), [
			'2026-05-01',
			'2026-05-31',
		]);
		expect(db.query.mock.calls[1][0]).toContain("AND pr.status IN ('SCHEDULED','COMPLETED')");
	});

	it('filters production runs to scheduled status when requested', async () => {
		db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

		await GET({
			url: urlWithParams({ year: '2026', month: '2', status: 'scheduled' }),
		});

		expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining("pr.status = 'SCHEDULED'"), [
			'2026-02-01',
			'2026-02-28',
		]);
	});

	it('filters production runs to completed status when requested', async () => {
		db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

		await GET({
			url: urlWithParams({ year: '2026', month: '4', status: 'completed' }),
		});

		expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining("pr.status = 'COMPLETED'"), [
			'2026-04-01',
			'2026-04-30',
		]);
	});
});
