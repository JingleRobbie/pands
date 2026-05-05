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
	return new URL(`http://pands.local/shipments/calendar/events?${new URLSearchParams(params)}`);
}

describe('shipment calendar events endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns an empty calendar when start or end is missing', async () => {
		const result = await GET({ url: urlWithParams({ start: '2026-05-01' }) });

		expect(result).toEqual({ json: {} });
		expect(db.query).not.toHaveBeenCalled();
	});

	it('groups shipments in the requested date range by ship date', async () => {
		db.query.mockResolvedValueOnce([
			[
				{
					id: 12,
					shipment_number: 'S-1',
					ship_date: new Date('2026-05-05T12:00:00Z'),
					status: 'DRAFT',
					so_number: 'SO-1',
					customer_name: 'Acme',
					job_name: 'North Wing',
				},
				{
					id: 13,
					shipment_number: 'S-2',
					ship_date: '2026-05-05',
					status: 'SHIPPED',
					so_number: 'SO-2',
					customer_name: 'Beta',
					job_name: 'South Wing',
				},
			],
		]);

		const result = await GET({
			url: urlWithParams({ start: '2026-05-01', end: '2026-05-31' }),
		});

		expect(result).toEqual({
			json: {
				'2026-05-05': [
					{
						id: 12,
						shipment_number: 'S-1',
						status: 'DRAFT',
						so_number: 'SO-1',
						customer_name: 'Acme',
						job_name: 'North Wing',
					},
					{
						id: 13,
						shipment_number: 'S-2',
						status: 'SHIPPED',
						so_number: 'SO-2',
						customer_name: 'Beta',
						job_name: 'South Wing',
					},
				],
			},
		});
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query).toHaveBeenCalledWith(expect.any(String), ['2026-05-01', '2026-05-31']);
	});

	it('prepends older unshipped draft shipments when requested', async () => {
		db.query
			.mockResolvedValueOnce([
				[
					{
						id: 13,
						shipment_number: 'S-2',
						ship_date: '2026-05-05',
						status: 'DRAFT',
						so_number: 'SO-2',
						customer_name: 'Beta',
						job_name: 'South Wing',
					},
				],
			])
			.mockResolvedValueOnce([
				[
					{
						id: 12,
						shipment_number: 'S-1',
						ship_date: '2026-04-30',
						status: 'DRAFT',
						so_number: 'SO-1',
						customer_name: 'Acme',
						job_name: 'North Wing',
					},
				],
			]);

		const result = await GET({
			url: urlWithParams({
				start: '2026-05-01',
				end: '2026-05-31',
				past_drafts: '1',
			}),
		});

		expect(result).toEqual({
			json: {
				'2026-04-30': [
					{
						id: 12,
						shipment_number: 'S-1',
						status: 'DRAFT',
						so_number: 'SO-1',
						customer_name: 'Acme',
						job_name: 'North Wing',
					},
				],
				'2026-05-05': [
					{
						id: 13,
						shipment_number: 'S-2',
						status: 'DRAFT',
						so_number: 'SO-2',
						customer_name: 'Beta',
						job_name: 'South Wing',
					},
				],
			},
		});
		expect(db.query).toHaveBeenNthCalledWith(1, expect.any(String), [
			'2026-05-01',
			'2026-05-31',
		]);
		expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining("s.status != 'SHIPPED'"), [
			'2026-05-01',
		]);
	});
});
