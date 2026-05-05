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
	return new URL(`http://pands.local/search?${new URLSearchParams(params)}`);
}

describe('search endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns an empty result without a search query or work order id', async () => {
		const result = await GET({ url: urlWithParams({ q: '   ' }) });

		expect(result).toEqual({ json: [] });
		expect(db.query).not.toHaveBeenCalled();
	});

	it('searches work orders by SO number prefix', async () => {
		const wos = [{ id: 12, so_number: 'SO-1', customer_name: 'Acme', job_name: 'North Wing' }];
		db.query.mockResolvedValueOnce([wos]);

		const result = await GET({ url: urlWithParams({ q: ' SO- ' }) });

		expect(result).toEqual({ json: wos });
		expect(db.query).toHaveBeenCalledWith(
			`SELECT id, so_number, customer_name, job_name, status
		 FROM work_orders WHERE so_number LIKE ? ORDER BY so_number LIMIT 10`,
			['SO-%']
		);
	});

	it('returns null when a requested work order is missing', async () => {
		db.query.mockResolvedValueOnce([[]]);

		const result = await GET({ url: urlWithParams({ wo_id: '12' }) });

		expect(result).toEqual({ json: null });
		expect(db.query).toHaveBeenCalledTimes(1);
	});

	it('returns work order detail with active runs, all runs, and shipments', async () => {
		const wo = {
			id: 12,
			so_number: 'SO-1',
			customer_name: 'Acme',
			job_name: 'North Wing',
			status: 'OPEN',
		};
		const activeRuns = [{ id: 21, run_number: 'R-1', status: 'SCHEDULED' }];
		const allRuns = [
			{ id: 21, run_number: 'R-1', status: 'SCHEDULED' },
			{ id: 22, run_number: 'R-2', status: 'COMPLETED' },
		];
		const shipments = [{ id: 31, shipment_number: 'S-1', status: 'DRAFT' }];
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([activeRuns])
			.mockResolvedValueOnce([allRuns])
			.mockResolvedValueOnce([shipments]);

		const result = await GET({ url: urlWithParams({ wo_id: '12' }) });

		expect(result).toEqual({
			json: {
				wo,
				activeRuns,
				allRuns,
				shipments,
			},
		});
		expect(db.query).toHaveBeenNthCalledWith(
			1,
			'SELECT id, so_number, customer_name, job_name, status FROM work_orders WHERE id = ?',
			[12]
		);
		expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining("pr.status != 'COMPLETED'"), [
			12,
		]);
		expect(db.query).toHaveBeenNthCalledWith(3, expect.stringContaining('WHERE wol.wo_id = ?'), [
			12,
		]);
		expect(db.query).toHaveBeenNthCalledWith(
			4,
			'SELECT id, shipment_number, status, ship_date FROM shipments WHERE wo_id = ? ORDER BY ship_date DESC',
			[12]
		);
	});
});
