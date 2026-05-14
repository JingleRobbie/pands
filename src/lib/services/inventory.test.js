import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db.js', () => ({ db: {} }));

const { __inventoryTest } = await import('./inventory.js');

describe('inventory helpers', () => {
	it('maps ledger aggregate rows to SKU balances', () => {
		expect(
			__inventoryTest.rowsToBalanceMap([
				{ sku_id: 1, balance: 100 },
				{ sku_id: 2, balance: -25 },
				{ sku_id: 3, balance: null },
			])
		).toEqual({ 1: 100, 2: -25, 3: 0 });
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
					billing_sku_id: 1,
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
			groupId: '99_1',
			billingSkuId: 1,
			deltas: { 1: -800 },
		});
		expect(rows[0].woLineId).toBeUndefined();
		expect(rows[0].cells[1]).toEqual({ delta: -800, runningTotal: -300 });
		expect(rows[0].cells[2]).toEqual({ delta: null, runningTotal: 200 });
		expect(running).toEqual({ 1: -300, 2: 200 });
	});

	it('groups unscheduled child lines by work order and billing sku', () => {
		const running = { 1: 1000, 2: 1000, 3: 1000 };
		const rows = __inventoryTest.buildUnscheduledRows(
			[
				{
					id: 20,
					sku_id: 2,
					billing_sku_id: 1,
					qty: 3,
					rolls_produced: 0,
					rolls_scheduled: 1,
					width_in: 24,
					length_ft: 50,
					customer_name: 'Acme',
					job_name: 'Shop',
					so_number: 'SO-2',
					wo_id: 100,
					ship_date: '2026-05-01',
					facing: 'Faced',
				},
				{
					id: 21,
					sku_id: 3,
					billing_sku_id: 1,
					qty: 2,
					rolls_produced: 0,
					rolls_scheduled: 0,
					width_in: 36,
					length_ft: 40,
					customer_name: 'Acme',
					job_name: 'Shop',
					so_number: 'SO-2',
					wo_id: 100,
					ship_date: '2026-05-01',
					facing: 'Unfaced',
				},
				{
					id: 22,
					sku_id: 2,
					billing_sku_id: 2,
					qty: 1,
					rolls_produced: 0,
					rolls_scheduled: 0,
					width_in: 24,
					length_ft: 50,
					customer_name: 'Acme',
					job_name: 'Shop',
					so_number: 'SO-2',
					wo_id: 100,
					ship_date: '2026-05-01',
					facing: 'Faced',
				},
			],
			[1, 2, 3],
			running
		);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			groupId: '100_1',
			billingSkuId: 1,
			deltas: { 2: -200, 3: -240 },
			facing: 'Faced, Unfaced',
		});
		expect(rows[0].cells[2]).toEqual({ delta: -200, runningTotal: 800 });
		expect(rows[0].cells[3]).toEqual({ delta: -240, runningTotal: 760 });
		expect(rows[1]).toMatchObject({
			groupId: '100_2',
			billingSkuId: 2,
			deltas: { 2: -100 },
			facing: 'Faced',
		});
		expect(rows[1].cells[2]).toEqual({ delta: -100, runningTotal: 700 });
		expect(rows[1].cells[3]).toEqual({ delta: null, runningTotal: 760 });
		expect(running).toEqual({ 1: 1000, 2: 700, 3: 760 });
	});
});
