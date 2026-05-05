import { beforeEach, describe, expect, it, vi } from 'vitest';

const { conn, db } = vi.hoisted(() => {
	const conn = {
		beginTransaction: vi.fn(),
		commit: vi.fn(),
		query: vi.fn(),
		release: vi.fn(),
		rollback: vi.fn(),
	};

	return {
		conn,
		db: {
			getConnection: vi.fn(() => conn),
			query: vi.fn(),
		},
	};
});

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	fail: vi.fn((status, data) => ({ status, data })),
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { actions } = await import('./+page.server.js');

describe('inventory count detail actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('delete', () => {
		it('rejects non-admin users before opening a transaction', async () => {
			await expect(
				actions.delete({
					params: { id: '44' },
					locals: { appUser: { id: 9, role: 'user' } },
				})
			).rejects.toEqual({ type: 'error', status: 403, message: 'Admin only' });

			expect(db.getConnection).not.toHaveBeenCalled();
		});

		it('deletes inventory count transactions and the count batch, then redirects', async () => {
			conn.query.mockResolvedValue([{}]);

			await expect(
				actions.delete({
					params: { id: '44' },
					locals: { appUser: { id: 9, role: 'admin' } },
				})
			).rejects.toEqual({
				type: 'redirect',
				status: 303,
				location: '/inventory/counts',
			});

			expect(db.getConnection).toHaveBeenCalledOnce();
			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.query).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("WHERE reference_type = 'INVENTORY_COUNT' AND reference_id = ?"),
				['44']
			);
			expect(conn.query).toHaveBeenNthCalledWith(
				2,
				'DELETE FROM inventory_counts WHERE id = ?',
				['44']
			);
			expect(conn.commit).toHaveBeenCalledOnce();
			expect(conn.rollback).not.toHaveBeenCalled();
			expect(conn.release).toHaveBeenCalledOnce();
		});

		it('rolls back and returns a user-facing failure when delete fails', async () => {
			conn.query.mockRejectedValueOnce(new Error('Database unavailable'));

			const result = await actions.delete({
				params: { id: '44' },
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({ status: 500, data: { error: 'Database unavailable' } });
			expect(conn.beginTransaction).toHaveBeenCalledOnce();
			expect(conn.commit).not.toHaveBeenCalled();
			expect(conn.rollback).toHaveBeenCalledOnce();
			expect(conn.release).toHaveBeenCalledOnce();
		});
	});
});
