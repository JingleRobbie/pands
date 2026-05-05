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

const { receivePoLines, unreceivePoLines } = await import('./purchasing.js');

describe('purchasing services', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('receivePoLines', () => {
		it('creates a receipt transaction, marks the line received, and commits', async () => {
			conn.query
				.mockResolvedValueOnce([[{ sku_id: 7 }]])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([[{ openCount: 0, receivedCount: 1 }]])
				.mockResolvedValueOnce([{}]);

			await receivePoLines(12, [{ lineId: 34, sqftReceived: 500 }], 9);

			expect(mockDb.getConnection).toHaveBeenCalledOnce();
			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.query).toHaveBeenNthCalledWith(
				1,
				'SELECT sku_id FROM purchase_order_lines WHERE id = ? AND po_id = ? AND status = ?',
				[34, 12, 'OPEN']
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining('INSERT INTO inventory_transactions'),
				[7, 500, 34, 9]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("SET status = 'RECEIVED', sqft_received = ?"),
				[500, 34, 12]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				5,
				"UPDATE purchase_orders SET status = 'RECEIVED' WHERE id = ?",
				[12]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('rolls back when a selected line is not open on the PO', async () => {
			conn.query.mockResolvedValueOnce([[]]);

			await expect(receivePoLines(12, [{ lineId: 34, sqftReceived: 500 }], 9)).rejects.toThrow(
				'Line 34 is not an open line on PO 12'
			);

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('keeps the PO open when other lines are still open', async () => {
			conn.query
				.mockResolvedValueOnce([[{ sku_id: 7 }]])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([[{ openCount: 1, receivedCount: 1 }]])
				.mockResolvedValueOnce([{}]);

			await receivePoLines(12, [{ lineId: 34, sqftReceived: 500 }], 9);

			expect(conn.query).toHaveBeenNthCalledWith(
				5,
				"UPDATE purchase_orders SET status = 'OPEN' WHERE id = ?",
				[12]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
		});
	});

	describe('unreceivePoLines', () => {
		it('rejects an empty selection before opening a transaction', async () => {
			await expect(unreceivePoLines(12, [], 9)).rejects.toThrow(
				'No received PO lines were selected.'
			);

			expect(mockDb.getConnection).not.toHaveBeenCalled();
		});

		it('creates a receipt reversal, reopens the line, and commits', async () => {
			conn.query
				.mockResolvedValueOnce([[{ id: 34, sku_id: 7, sqft_received: 500 }]])
				.mockResolvedValueOnce([
					[
						{
							id: 101,
							sku_id: 7,
							sqft_quantity: 500,
							effective_date: '2026-05-01',
						},
					],
				])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([[{ openCount: 1, receivedCount: 0 }]])
				.mockResolvedValueOnce([{}]);

			await unreceivePoLines(12, [34], 9);

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.query).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining('INSERT INTO inventory_transactions'),
				[7, 500, '2026-05-01', 34, 101, 'Unreceived PO line 34', 9]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				4,
				expect.stringContaining("SET status = 'OPEN', sqft_received = NULL"),
				[34, 12]
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				6,
				"UPDATE purchase_orders SET status = 'OPEN' WHERE id = ?",
				[12]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('rolls back when a selected line is not received on the PO', async () => {
			conn.query.mockResolvedValueOnce([[]]);

			await expect(unreceivePoLines(12, [34], 9)).rejects.toThrow(
				'Line 34 is not a received line on PO 12'
			);

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('rolls back when the received line has no active receipt transaction', async () => {
			conn.query
				.mockResolvedValueOnce([[{ id: 34, sku_id: 7, sqft_received: 500 }]])
				.mockResolvedValueOnce([[]]);

			await expect(unreceivePoLines(12, [34], 9)).rejects.toThrow(
				'Line 34 does not have an active receipt transaction to reverse.'
			);

			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('stores null created_by when unreceiving without a user id', async () => {
			conn.query
				.mockResolvedValueOnce([[{ id: 34, sku_id: 7, sqft_received: 500 }]])
				.mockResolvedValueOnce([
					[
						{
							id: 101,
							sku_id: 7,
							sqft_quantity: 500,
							effective_date: '2026-05-01',
						},
					],
				])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([{}])
				.mockResolvedValueOnce([[{ openCount: 1, receivedCount: 0 }]])
				.mockResolvedValueOnce([{}]);

			await unreceivePoLines(12, [34]);

			expect(conn.query).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining('INSERT INTO inventory_transactions'),
				[7, 500, '2026-05-01', 34, 101, 'Unreceived PO line 34', null]
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
		});
	});
});
