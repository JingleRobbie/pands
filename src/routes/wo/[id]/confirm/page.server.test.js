import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmRun, deleteRun } = vi.hoisted(() => ({
	confirmRun: vi.fn(),
	deleteRun: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db: { query: vi.fn() } }));
vi.mock('$lib/services/inventory.js', () => ({ getMatrixDataForSkus: vi.fn() }));
vi.mock('$lib/services/production.js', () => ({ confirmRun, deleteRun }));
vi.mock('$lib/auth.js', () => ({
	requireAdmin: vi.fn((locals) =>
		locals.appUser?.role === 'admin' ? null : { status: 403, data: { error: 'Admin only' } }
	),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	fail: vi.fn((status, data) => ({ status, data })),
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

describe('work order confirm actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('confirm', () => {
		it('rejects non-admin users before calling the service', async () => {
			const result = await actions.confirm({
				request: requestWithForm([['run_id', '77']]),
				locals: { appUser: { id: 9, role: 'user' } },
			});

			expect(result).toEqual({ status: 403, data: { error: 'Admin only' } });
			expect(confirmRun).not.toHaveBeenCalled();
		});

		it('rejects empty confirmations before calling the service', async () => {
			const result = await actions.confirm({
				request: requestWithForm([]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({ status: 400, data: { error: 'No runs to confirm.' } });
			expect(confirmRun).not.toHaveBeenCalled();
		});

		it('rejects invalid roll counts before calling the service', async () => {
			const result = await actions.confirm({
				request: requestWithForm([
					['run_id', '77'],
					['rolls_77', '0'],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({
				status: 400,
				data: { error: 'Enter a valid roll count for all runs.' },
			});
			expect(confirmRun).not.toHaveBeenCalled();
		});

		it('confirms all runs and returns shortfall details', async () => {
			confirmRun
				.mockResolvedValueOnce({ shortfallRunNumber: 'PR-1', shortfallRolls: 2 })
				.mockResolvedValueOnce({ shortfallRunNumber: null, shortfallRolls: null });

			const result = await actions.confirm({
				request: requestWithForm([
					['run_id', '77'],
					['run_id', '78'],
					['rolls_77', '3'],
					['rolls_78', '2'],
					['date_77', '2026-05-01'],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({
				success: true,
				confirmed: 2,
				shortfalls: [{ runNumber: 'PR-1', rolls: 2 }],
			});
			expect(confirmRun).toHaveBeenNthCalledWith(1, 77, 3, 9, '2026-05-01');
			expect(confirmRun).toHaveBeenNthCalledWith(2, 78, 2, 9, null);
		});

		it('returns a user-facing failure when confirmation is rejected', async () => {
			confirmRun.mockRejectedValueOnce(new Error('This run is already completed.'));

			const result = await actions.confirm({
				request: requestWithForm([
					['run_id', '77'],
					['rolls_77', '3'],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({
				status: 400,
				data: { error: 'This run is already completed.' },
			});
		});
	});

	describe('remove', () => {
		it('rejects missing run ids before calling deleteRun', async () => {
			const result = await actions.remove({
				request: requestWithForm([]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({ status: 400, data: { error: 'No run specified.' } });
			expect(deleteRun).not.toHaveBeenCalled();
		});

		it('deletes the run and returns deleted state', async () => {
			deleteRun.mockResolvedValueOnce();

			const result = await actions.remove({
				request: requestWithForm([['run_id', '77']]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({ deleted: true });
			expect(deleteRun).toHaveBeenCalledWith(77);
		});

		it('returns a user-facing failure when delete is rejected', async () => {
			deleteRun.mockRejectedValueOnce(new Error('Cannot delete a completed run.'));

			const result = await actions.remove({
				request: requestWithForm([['run_id', '77']]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({
				status: 400,
				data: { error: 'Cannot delete a completed run.' },
			});
		});
	});
});
