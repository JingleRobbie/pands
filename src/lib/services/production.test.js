import { beforeEach, describe, expect, it, vi } from 'vitest';

const { conn, mockDb } = vi.hoisted(() => {
	const conn = {
		beginTransaction: vi.fn(),
		commit: vi.fn(),
		query: vi.fn(),
		release: vi.fn(),
		rollback: vi.fn(),
	};

	return {
		conn,
		mockDb: {
			getConnection: vi.fn(() => conn),
		},
	};
});

vi.mock('$lib/db.js', () => ({ db: mockDb }));

const { __productionTest, confirmRun, unproduceRun } = await import('./production.js');

beforeEach(() => {
	vi.clearAllMocks();
});

describe('production helpers', () => {
	it('calculates square feet from rolls, width, and length', () => {
		expect(__productionTest.calcSqft({ width_in: 48, length_ft: 100 }, 3)).toBe(1200);
	});

	it('normalizes date-like values to yyyy-mm-dd', () => {
		expect(__productionTest.dateOnly('2026-04-07T10:30:00.000Z')).toBe('2026-04-07');
		expect(__productionTest.dateOnly(new Date('2026-04-07T12:00:00.000Z'))).toBe('2026-04-07');
		expect(__productionTest.dateOnly(null)).toBeNull();
	});

	it('validates scheduled rolls against remaining rolls', () => {
		expect(() => __productionTest.validateRollsScheduled(0, 3)).toThrow(
			'Rolls scheduled must be greater than zero.'
		);
		expect(() => __productionTest.validateRollsScheduled(4, 3, 'line 10')).toThrow(
			'Cannot schedule 4 rolls for line 10 - only 3 remaining.'
		);
	});

	it('rejects missing, completed, and over-produced runs', () => {
		expect(() => __productionTest.validateConfirmableRun(null, 1)).toThrow(
			'Production run not found.'
		);
		expect(() =>
			__productionTest.validateConfirmableRun({ status: 'COMPLETED', rolls_scheduled: 2 }, 1)
		).toThrow('This run is already completed.');
		expect(() =>
			__productionTest.validateConfirmableRun({ status: 'SCHEDULED', rolls_scheduled: 2 }, 3)
		).toThrow('Cannot record 3 rolls - only 2 rolls were scheduled.');
	});

	it('validates unproduce rolls against unshipped rolls', () => {
		expect(() => __productionTest.validateUnproduceRolls(0, 3)).toThrow(
			'Rolls to unproduce must be greater than zero.'
		);
		expect(() => __productionTest.validateUnproduceRolls(4, 3)).toThrow(
			'Cannot unproduce 4 rolls - only 3 rolls are unshipped.'
		);
		expect(() => __productionTest.validateUnproduceRolls(3, 3)).not.toThrow();
	});

	it('uses exact actual square feet when fully unproducing a run', () => {
		const line = { width_in: 48, length_ft: 100 };
		const run = { rolls_actual: 3, sqft_actual: 1199 };

		expect(__productionTest.prorateUnproduceSqft(line, run, 3)).toBe(1199);
		expect(__productionTest.prorateUnproduceSqft(line, run, 2)).toBe(800);
	});
});

describe('production services', () => {
	describe('confirmRun', () => {
		it('creates a consumption transaction, completes the run, and closes the work order', async () => {
			conn.query
				.mockResolvedValueOnce([
					[
						{
							id: 77,
							wo_line_id: 55,
							sku_id: 7,
							run_number: 'PR-1',
							status: 'SCHEDULED',
							run_date: null,
							rolls_scheduled: 2,
						},
					],
				])
				.mockResolvedValueOnce([
					[
						{
							id: 55,
							wo_id: 22,
							width_in: 48,
							length_ft: 100,
							so_number: 'SO-1',
							job_name: 'Shop',
						},
					],
				])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([[{ incomplete: 0 }]])
				.mockResolvedValueOnce([{}]);

			await expect(confirmRun(77, 2, 9, '2026-05-01')).resolves.toEqual({
				shortfallRolls: null,
				shortfallRunNumber: null,
			});

			expect(mockDb.getConnection).toHaveBeenCalledOnce();
			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.query).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining('INSERT INTO inventory_transactions'),
				[7, 800, '2026-05-01', 77, 'Run PR-1 - SO-1 Shop', 9]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining("status = 'COMPLETED'"),
				[2, 800, '2026-05-01', 9, 77]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				7,
				'UPDATE work_orders SET status = "COMPLETE" WHERE id = ?',
				[22]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('rolls back when the run is already completed', async () => {
			conn.query.mockResolvedValueOnce([
				[{ id: 77, status: 'COMPLETED', rolls_scheduled: 2 }],
			]);

			await expect(confirmRun(77, 1, 9)).rejects.toThrow('This run is already completed.');

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});
	});

	describe('unproduceRun', () => {
		it('creates a full consumption reversal and reopens the completed run', async () => {
			conn.query
				.mockResolvedValueOnce([
					[
						{
							id: 77,
							wo_line_id: 55,
							wo_id: 22,
							sku_id: 7,
							run_number: 'PR-1',
							status: 'COMPLETED',
							run_date: '2026-05-01',
							rolls_actual: 3,
							sqft_actual: 1199,
						},
					],
				])
				.mockResolvedValueOnce([[{ id: 55, width_in: 48, length_ft: 100 }]])
				.mockResolvedValueOnce([[{ shippedRolls: 0 }]])
				.mockResolvedValueOnce([[{ id: 201, effective_date: '2026-05-01' }]])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}]);

			await expect(unproduceRun(77, 3, 9)).resolves.toEqual({
				rollsUnproduced: 3,
				shortfallRunNumber: null,
				sqftUnproduced: 1199,
				woId: 22,
			});

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.query).toHaveBeenNthCalledWith(
				5,
				expect.stringContaining('INSERT INTO inventory_transactions'),
				[
					7,
					1199,
					'2026-05-01',
					77,
					201,
					'Unproduced 3 rolls from run PR-1',
					9,
				]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				6,
				expect.stringContaining("SET status = ?"),
				['SCHEDULED', 3, 1199, 77]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				7,
				expect.stringContaining('SET rolls_produced = GREATEST(rolls_produced - ?, 0)'),
				[3, 55]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('rolls back when the run has no consumption transaction to reverse', async () => {
			conn.query
				.mockResolvedValueOnce([
					[
						{
							id: 77,
							wo_line_id: 55,
							wo_id: 22,
							sku_id: 7,
							run_number: 'PR-1',
							status: 'COMPLETED',
							run_date: '2026-05-01',
							rolls_actual: 3,
							sqft_actual: 1199,
						},
					],
				])
				.mockResolvedValueOnce([[{ id: 55, width_in: 48, length_ft: 100 }]])
				.mockResolvedValueOnce([[{ shippedRolls: 0 }]])
				.mockResolvedValueOnce([[]]);

			await expect(unproduceRun(77, 1, 9)).rejects.toThrow(
				'Run PR-1 does not have a consumption transaction to reverse.'
			);

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});
	});
});
