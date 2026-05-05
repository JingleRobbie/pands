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

function requestWithForm(entries) {
	return {
		formData: async () => {
			const data = new FormData();
			for (const [key, value] of entries) {
				data.append(key, value);
			}
			return data;
		},
	};
}

describe('production edit action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects invalid scheduled roll counts before opening a transaction', async () => {
		const result = await actions.default({
			params: { id: '77' },
			request: requestWithForm([
				['return_to', '/production'],
				['rolls_scheduled', '0'],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Rolls scheduled must be at least 1.' },
		});
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('updates the run and redirects to confirmation with returnTo preserved', async () => {
		conn.query
			.mockResolvedValueOnce([[{ id: 77, wo_line_id: 55, status: 'SCHEDULED' }]])
			.mockResolvedValueOnce([[{ qty: 10, rolls_produced: 2, width_in: 48, length_ft: 100 }]])
			.mockResolvedValueOnce([[{ otherScheduled: 3 }]])
			.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				params: { id: '77' },
				request: requestWithForm([
					['return_to', '/production?status=scheduled'],
					['run_date', '2026-05-01'],
					['rolls_scheduled', '4'],
				]),
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/production/77/confirm?returnTo=%2Fproduction%3Fstatus%3Dscheduled',
		});

		expect(db.getConnection).toHaveBeenCalledOnce();
		expect(conn.beginTransaction).toHaveBeenCalledOnce();
		expect(conn.query).toHaveBeenNthCalledWith(
			4,
			'UPDATE production_runs SET run_date = ?, rolls_scheduled = ?, sqft_scheduled = ?, status = ? WHERE id = ?',
			['2026-05-01', 4, 1600, 'SCHEDULED', '77']
		);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('rejects completed runs and releases the connection', async () => {
		conn.query.mockResolvedValueOnce([[{ id: 77, wo_line_id: 55, status: 'COMPLETED' }]]);

		const result = await actions.default({
			params: { id: '77' },
			request: requestWithForm([
				['return_to', '/production'],
				['rolls_scheduled', '4'],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Completed runs cannot be edited.' },
		});
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('rejects roll counts above available quantity', async () => {
		conn.query
			.mockResolvedValueOnce([[{ id: 77, wo_line_id: 55, status: 'SCHEDULED' }]])
			.mockResolvedValueOnce([[{ qty: 10, rolls_produced: 2, width_in: 48, length_ft: 100 }]])
			.mockResolvedValueOnce([[{ otherScheduled: 3 }]]);

		const result = await actions.default({
			params: { id: '77' },
			request: requestWithForm([
				['return_to', '/production'],
				['rolls_scheduled', '6'],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: expect.stringContaining('Cannot schedule 6 rolls') },
		});
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('rolls back and returns a user-facing failure when an update throws', async () => {
		conn.query
			.mockResolvedValueOnce([[{ id: 77, wo_line_id: 55, status: 'SCHEDULED' }]])
			.mockResolvedValueOnce([[{ qty: 10, rolls_produced: 2, width_in: 48, length_ft: 100 }]])
			.mockResolvedValueOnce([[{ otherScheduled: 3 }]])
			.mockRejectedValueOnce(new Error('Database unavailable'));

		const result = await actions.default({
			params: { id: '77' },
			request: requestWithForm([
				['return_to', '/production'],
				['rolls_scheduled', '4'],
			]),
		});

		expect(result).toEqual({ status: 500, data: { error: 'Database unavailable' } });
		expect(conn.rollback).toHaveBeenCalledOnce();
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});
});
