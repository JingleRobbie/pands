import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db.js', () => ({ db: {} }));

const { __inventoryTest } = await import('./inventory.js');

describe('inventory helpers', () => {
	it('merges transaction balances with received PO quantities', () => {
		expect(
			__inventoryTest.mergeBalanceRows(
				[
					{ sku_id: 1, balance: 100 },
					{ sku_id: 2, balance: -25 },
				],
				[
					{ sku_id: 1, received: 50 },
					{ sku_id: 3, received: 75 },
				]
			)
		).toEqual({ 1: 150, 2: -25, 3: 75 });
	});

	it('builds running cells for every matrix sku', () => {
		expect(__inventoryTest.buildCells([1, 2], { 2: -40 }, { 1: 10, 2: 60 })).toEqual({
			1: { delta: null, runningTotal: 10 },
			2: { delta: -40, runningTotal: 60 },
		});
	});

	it('builds unscheduled rows and advances running totals', () => {
		const running = { 1: 500, 2: 200 };
		const rows = __inventoryTest.buildUnscheduledRows(
			[
				{
					id: 10,
					sku_id: 1,
					qty: 5,
					rolls_produced: 1,
					rolls_scheduled: 2,
					width_in: 48,
					length_ft: 100,
					customer_name: 'Acme',
					job_name: 'Shop',
					so_number: 'SO-1',
					wo_id: 99,
					ship_date: '2026-04-30',
					facing: 'Faced',
				},
				{
					id: 11,
					sku_id: 2,
					qty: 1,
					rolls_produced: 1,
					rolls_scheduled: 0,
					width_in: 24,
					length_ft: 50,
				},
			],
			[1, 2],
			running
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			rowType: 'unscheduled',
			partyName: 'Acme',
			description: 'Shop',
			deltas: { 1: -800 },
		});
		expect(rows[0].cells[1]).toEqual({ delta: -800, runningTotal: -300 });
		expect(rows[0].cells[2]).toEqual({ delta: null, runningTotal: 200 });
		expect(running).toEqual({ 1: -300, 2: 200 });
	});
});
