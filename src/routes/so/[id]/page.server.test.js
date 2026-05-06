import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, getMatrixDataForSkus } = vi.hoisted(() => ({
	db: { query: vi.fn() },
	getMatrixDataForSkus: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/services/inventory.js', () => ({ getMatrixDataForSkus }));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
}));

const { load } = await import('./+page.server.js');

describe('sales order detail load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws 404 when the sales order is missing', async () => {
		db.query.mockResolvedValueOnce([[undefined]]);

		await expect(load({ params: { id: '12' } })).rejects.toEqual({
			type: 'error',
			status: 404,
			message: 'SO not found',
		});

		expect(db.query).toHaveBeenCalledWith('SELECT * FROM sales_orders WHERE id = ?', ['12']);
		expect(getMatrixDataForSkus).not.toHaveBeenCalled();
	});

	it('loads lines, open runs, matrix data, and linked work order id', async () => {
		const so = { id: 12, so_number: 'SO-12' };
		const lines = [
			{
				id: 100,
				sku_id: 3,
				sqft_ordered: 1000,
				sqft_produced: 200,
				sqft_scheduled: 300,
			},
			{
				id: 101,
				sku_id: 3,
				sqft_ordered: 50,
				sqft_produced: 100,
				sqft_scheduled: 25,
			},
			{
				id: 102,
				sku_id: 4,
				sqft_ordered: 500,
				sqft_produced: 0,
				sqft_scheduled: 0,
			},
		];
		const runsForFirstLine = [{ id: 201, so_line_id: 100 }];
		const runsForSecondLine = [{ id: 202, so_line_id: 101 }];
		const runsForThirdLine = [];
		const matrix = { rows: [], skus: [] };

		db.query
			.mockResolvedValueOnce([[so]])
			.mockResolvedValueOnce([lines])
			.mockResolvedValueOnce([runsForFirstLine])
			.mockResolvedValueOnce([runsForSecondLine])
			.mockResolvedValueOnce([runsForThirdLine])
			.mockResolvedValueOnce([[{ id: 42 }]]);
		getMatrixDataForSkus.mockResolvedValueOnce(matrix);

		const result = await load({ params: { id: '12' } });

		expect(db.query).toHaveBeenCalledTimes(6);
		expect(db.query.mock.calls[1][1]).toEqual(['12']);
		expect(db.query.mock.calls[2][1]).toEqual([100]);
		expect(db.query.mock.calls[3][1]).toEqual([101]);
		expect(db.query.mock.calls[4][1]).toEqual([102]);
		expect(db.query.mock.calls[5]).toEqual([
			'SELECT id FROM work_orders WHERE so_number = ?',
			['SO-12'],
		]);
		expect(getMatrixDataForSkus).toHaveBeenCalledWith([3, 4]);
		expect(result).toEqual({
			so,
			lineData: [
				{ line: lines[0], runs: runsForFirstLine, sqftUnscheduled: 500 },
				{ line: lines[1], runs: runsForSecondLine, sqftUnscheduled: 0 },
				{ line: lines[2], runs: runsForThirdLine, sqftUnscheduled: 500 },
			],
			matrix,
			woId: 42,
		});
	});
});
