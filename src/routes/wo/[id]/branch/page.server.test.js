import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, branchLine, getBranchEditBlockers, updateBranchLine, requireAdmin } = vi.hoisted(
	() => ({
		db: { query: vi.fn() },
		branchLine: vi.fn(),
		getBranchEditBlockers: vi.fn(),
		updateBranchLine: vi.fn(),
		requireAdmin: vi.fn(),
	})
);

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/auth.js', () => ({ requireAdmin }));
vi.mock('$lib/services/cutdown.js', () => ({
	branchLine,
	getBranchEditBlockers,
	updateBranchLine,
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	fail: vi.fn((status, data) => ({ status, data })),
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { actions, load } = await import('./+page.server.js');

function branchUrl(lineId) {
	return new URL(`http://localhost/wo/42/branch?lineId=${lineId}`);
}

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

describe('work order branch page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireAdmin.mockReturnValue(null);
	});

	it('loads create mode for an unbranched source line', async () => {
		const wo = { id: 42, so_number: 'SO-42' };
		const line = { id: 34, wo_id: 42, parent_line_id: null, width_in: 60 };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([[line]])
			.mockResolvedValueOnce([[{ childCount: 0 }]]);

		const result = await load({ params: { id: '42' }, url: branchUrl(34) });

		expect(result).toEqual({
			wo,
			line,
			productionLines: [],
			isEditMode: false,
			editBlockers: [],
		});
		expect(getBranchEditBlockers).not.toHaveBeenCalled();
	});

	it('loads edit mode with existing production child rows', async () => {
		const wo = { id: 42, so_number: 'SO-42' };
		const line = { id: 34, wo_id: 42, parent_line_id: null, width_in: 60 };
		const productionLines = [
			{ id: 44, parent_line_id: 34, width_in: 48 },
			{ id: 45, parent_line_id: 34, width_in: 12 },
		];
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([[line]])
			.mockResolvedValueOnce([[{ childCount: 2 }]])
			.mockResolvedValueOnce([productionLines]);
		getBranchEditBlockers.mockResolvedValueOnce([]);

		const result = await load({ params: { id: '42' }, url: branchUrl(34) });

		expect(result).toEqual({
			wo,
			line,
			productionLines,
			isEditMode: true,
			editBlockers: [],
		});
		expect(getBranchEditBlockers).toHaveBeenCalledWith(34);
	});

	it('dispatches edit submissions to updateBranchLine', async () => {
		updateBranchLine.mockResolvedValueOnce([101, 102]);

		await expect(
			actions.branch({
				params: { id: '42' },
				locals: { appUser: { id: 9 } },
				request: requestWithForm([
					['woLineId', '34'],
					['mode', 'edit'],
					['width_0', '48'],
					['qty_0', '5'],
					['length_ft_0', '75'],
					['width_1', '12'],
					['qty_1', '5'],
					['length_ft_1', '75'],
				]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/wo/42?tab=production' });

		expect(requireAdmin).toHaveBeenCalledWith({ appUser: { id: 9 } });
		expect(updateBranchLine).toHaveBeenCalledWith(
			34,
			42,
			[
				{ width_in: 48, qty: 5, length_ft: 75 },
				{ width_in: 12, qty: 5, length_ft: 75 },
			],
			9
		);
		expect(branchLine).not.toHaveBeenCalled();
	});

	it('returns admin failures before dispatching branch changes', async () => {
		requireAdmin.mockReturnValueOnce({ status: 403, data: { error: 'Admin access required.' } });

		const result = await actions.branch({
			params: { id: '42' },
			locals: { appUser: { id: 9, role: 'user' } },
			request: requestWithForm([
				['woLineId', '34'],
				['mode', 'edit'],
				['width_0', '48'],
			]),
		});

		expect(result).toEqual({ status: 403, data: { error: 'Admin access required.' } });
		expect(updateBranchLine).not.toHaveBeenCalled();
		expect(branchLine).not.toHaveBeenCalled();
	});

	it('dispatches create submissions to branchLine with the route work order id', async () => {
		branchLine.mockResolvedValueOnce([101]);

		await expect(
			actions.branch({
				params: { id: '42' },
				locals: { appUser: { id: 9 } },
				request: requestWithForm([
					['woLineId', '34'],
					['mode', 'create'],
					['width_0', '48'],
					['qty_0', '5'],
					['length_ft_0', '75'],
				]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/wo/42?tab=production' });

		expect(branchLine).toHaveBeenCalledWith(
			34,
			42,
			[{ width_in: 48, qty: 5, length_ft: 75 }],
			9
		);
		expect(updateBranchLine).not.toHaveBeenCalled();
	});

	it('returns fail when an edit is blocked by downstream activity', async () => {
		updateBranchLine.mockRejectedValueOnce(
			new Error('Cannot edit branch because it has downstream cut-down activity.')
		);

		const result = await actions.branch({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			request: requestWithForm([
				['woLineId', '34'],
				['mode', 'edit'],
				['width_0', '48'],
				['qty_0', '5'],
				['length_ft_0', '75'],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Cannot edit branch because it has downstream cut-down activity.' },
		});
	});
});
