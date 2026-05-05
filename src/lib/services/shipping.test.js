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

const { __shippingTest, confirmShipment, createShipment } = await import('./shipping.js');

beforeEach(() => {
	vi.clearAllMocks();
});

describe('shipping helpers', () => {
	it('prorates partial run sqft and preserves full-run totals', () => {
		expect(__shippingTest.prorateSqft(2, 5, 101)).toBe(40);
		expect(__shippingTest.prorateSqft(5, 5, 101)).toBe(101);
	});

	it('rejects invalid roll counts', () => {
		expect(() => __shippingTest.validateRollsToShip(0, 3)).toThrow(
			'Rolls to ship must be greater than zero.'
		);
		expect(() => __shippingTest.validateRollsToShip(4, 3)).toThrow(
			'Cannot ship 4 rolls - only 3 rolls are available.'
		);
	});
});

describe('shipping services', () => {
	describe('createShipment', () => {
		it('creates a shipment from a completed run and commits', async () => {
			conn.query
				.mockResolvedValueOnce([
					[
						{
							id: 77,
							sku_id: 7,
							wo_line_id: 55,
							group_id: null,
							rolls_actual: 3,
							sqft_actual: 1200,
							run_date: '2026-05-01',
							wo_id: 22,
						},
					],
				])
				.mockResolvedValueOnce([[{ so_number: 'SO-1' }]])
				.mockResolvedValueOnce([[{ n: 0 }]])
				.mockResolvedValueOnce([{ insertId: 123 }])
				.mockResolvedValueOnce([{}]);

			await expect(createShipment(22, 5, '2026-05-02', [77], 9)).resolves.toEqual({
				shipmentId: 123,
				shipmentNumber: 'SO-1-S1',
			});

			expect(mockDb.getConnection).toHaveBeenCalledOnce();
			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.query).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining('INSERT INTO shipments'),
				['SO-1-S1', 22, 5, '2026-05-02', 9]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				5,
				expect.stringContaining('INSERT INTO shipment_lines'),
				[123, 77, 7, 3, 1200]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('splits a partial run into shipped and remainder quantities', async () => {
			conn.query
				.mockResolvedValueOnce([
					[
						{
							id: 77,
							sku_id: 7,
							wo_line_id: 55,
							group_id: null,
							rolls_actual: 5,
							sqft_actual: 101,
							run_date: '2026-05-01',
							wo_id: 22,
						},
					],
				])
				.mockResolvedValueOnce([[{ so_number: 'SO-1' }]])
				.mockResolvedValueOnce([[{ n: 1 }]])
				.mockResolvedValueOnce([{ insertId: 123 }])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([[{ last: null }]])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}]);

			await createShipment(22, 5, '2026-05-02', [77], 9, { 77: 2 });

			expect(conn.query).toHaveBeenNthCalledWith(
				5,
				'UPDATE production_runs SET rolls_actual = ?, sqft_actual = ? WHERE id = ?',
				[2, 40, 77]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				7,
				expect.stringContaining('INSERT INTO production_runs'),
				[expect.stringMatching(/^PR-\d{8}-001$/), 3, 61, 3, 61, 9, 77]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				8,
				expect.stringContaining('INSERT INTO shipment_lines'),
				[123, 77, 7, 2, 40]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
		});

		it('rolls back when a selected run is not completed or does not exist', async () => {
			conn.query.mockResolvedValueOnce([[]]);

			await expect(createShipment(22, 5, '2026-05-02', [77], 9)).rejects.toThrow(
				'One or more selected runs are not completed or do not exist.'
			);

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});
	});

	describe('confirmShipment', () => {
		it('reduces shipment lines, creates a remainder run, and marks the shipment shipped', async () => {
			conn.query
				.mockResolvedValueOnce([[{ id: 15, production_run_id: 77, rolls: 5, sqft: 101 }]])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([[{ last: 'PR-20260501-002' }]])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}]);

			await confirmShipment(123, { 15: 2 }, 9);

			expect(conn.query).toHaveBeenNthCalledWith(
				2,
				'UPDATE shipment_lines SET rolls = ?, sqft = ? WHERE id = ?',
				[2, 40, 15]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining('INSERT INTO production_runs'),
				[expect.stringMatching(/^PR-\d{8}-003$/), 3, 61, 3, 61, 9, 77]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				5,
				"UPDATE shipments SET status = 'SHIPPED' WHERE id = ?",
				[123]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('rolls back when a line reduction requests too many rolls', async () => {
			conn.query.mockResolvedValueOnce([
				[{ id: 15, production_run_id: 77, rolls: 5, sqft: 101 }],
			]);

			await expect(confirmShipment(123, { 15: 6 }, 9)).rejects.toThrow(
				'Cannot ship 6 rolls - only 5 rolls are available.'
			);

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});
	});
});
