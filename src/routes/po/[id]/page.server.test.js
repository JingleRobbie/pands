import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, unreceivePoLines } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
	unreceivePoLines: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/auth.js', () => ({
	requireAdmin: vi.fn((locals) =>
		locals.appUser?.role === 'admin' ? null : { status: 403, data: { error: 'Admin only' } }
	),
}));
vi.mock('$lib/services/inventory.js', () => ({ getMatrixDataForSkus: vi.fn() }));
vi.mock('$lib/services/purchasing.js', () => ({ unreceivePoLines }));

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

describe('PO detail actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('unreceive', () => {
		it('rejects non-admin users before querying lines or calling the service', async () => {
			const result = await actions.unreceive({
				params: { id: '12' },
				request: requestWithForm([['return_to', '/po']]),
				locals: { appUser: { id: 9, role: 'user' } },
			});

			expect(result).toEqual({ status: 403, data: { error: 'Admin only' } });
			expect(db.query).not.toHaveBeenCalled();
			expect(unreceivePoLines).not.toHaveBeenCalled();
		});

		it('unreceives selected lines and redirects back to the PO detail with returnTo', async () => {
			unreceivePoLines.mockResolvedValueOnce();

			await expect(
				actions.unreceive({
					params: { id: '12' },
					request: requestWithForm([
						['return_to', '/po?status=received'],
						['line_id', '34'],
						['line_id', '35'],
					]),
					locals: { appUser: { id: 9, role: 'admin' } },
				})
			).rejects.toEqual({
				type: 'redirect',
				status: 303,
				location: '/po/12?returnTo=%2Fpo%3Fstatus%3Dreceived',
			});

			expect(db.query).not.toHaveBeenCalled();
			expect(unreceivePoLines).toHaveBeenCalledWith(12, [34, 35], 9);
		});

		it('falls back to all received lines when none are selected', async () => {
			db.query.mockResolvedValueOnce([[{ id: 34 }, { id: 35 }]]);
			unreceivePoLines.mockResolvedValueOnce();

			await expect(
				actions.unreceive({
					params: { id: '12' },
					request: requestWithForm([['return_to', '/po']]),
					locals: { appUser: { id: 9, role: 'admin' } },
				})
			).rejects.toEqual({
				type: 'redirect',
				status: 303,
				location: '/po/12?returnTo=%2Fpo',
			});

			expect(db.query).toHaveBeenCalledWith(
				expect.stringContaining("WHERE po_id = ? AND status = 'RECEIVED'"),
				['12']
			);
			expect(unreceivePoLines).toHaveBeenCalledWith(12, [34, 35], 9);
		});

		it('returns a user-facing failure when the service rejects unreceive', async () => {
			unreceivePoLines.mockRejectedValueOnce(
				new Error('Line 34 is not a received line on PO 12')
			);

			const result = await actions.unreceive({
				params: { id: '12' },
				request: requestWithForm([
					['return_to', '/po'],
					['line_id', '34'],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({
				status: 500,
				data: { error: 'Line 34 is not a received line on PO 12' },
			});
		});

		it('falls back to the PO list when return_to is unsafe', async () => {
			unreceivePoLines.mockResolvedValueOnce();

			await expect(
				actions.unreceive({
					params: { id: '12' },
					request: requestWithForm([
						['return_to', 'https://example.com'],
						['line_id', '34'],
					]),
					locals: { appUser: { id: 9, role: 'admin' } },
				})
			).rejects.toEqual({
				type: 'redirect',
				status: 303,
				location: '/po/12?returnTo=%2Fpo',
			});
		});
	});
});
