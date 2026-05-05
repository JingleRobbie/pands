import { beforeEach, describe, expect, it, vi } from 'vitest';

const { unproduceRun } = vi.hoisted(() => ({
	unproduceRun: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db: { query: vi.fn() } }));
vi.mock('$lib/services/production.js', () => ({ unproduceRun }));

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

describe('production unproduce action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects non-admin users', async () => {
		await expect(
			actions.default({
				request: requestWithForm([]),
				locals: { appUser: { id: 9, role: 'user' } },
			})
		).rejects.toEqual({ type: 'error', status: 403, message: 'Admin only' });

		expect(unproduceRun).not.toHaveBeenCalled();
	});

	it('rejects invalid production runs before calling the service', async () => {
		const result = await actions.default({
			request: requestWithForm([
				['run_id', '0'],
				['rolls_to_unproduce', '1'],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Select a valid production run.' },
		});
		expect(unproduceRun).not.toHaveBeenCalled();
	});

	it('rejects invalid roll counts before calling the service', async () => {
		const result = await actions.default({
			request: requestWithForm([
				['run_id', '77'],
				['rolls_to_unproduce', '0'],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Enter a valid roll count.' } });
		expect(unproduceRun).not.toHaveBeenCalled();
	});

	it('returns a user-facing failure when the service rejects unproduce', async () => {
		unproduceRun.mockRejectedValueOnce(
			new Error('Cannot unproduce 4 rolls - only 3 rolls are unshipped.')
		);

		const result = await actions.default({
			request: requestWithForm([
				['run_id', '77'],
				['rolls_to_unproduce', '4'],
				['return_to', '/production'],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(unproduceRun).toHaveBeenCalledWith(77, 4, 9);
		expect(result).toEqual({
			status: 500,
			data: { error: 'Cannot unproduce 4 rolls - only 3 rolls are unshipped.' },
		});
	});

	it('unproduces the run and preserves selected date and return path', async () => {
		unproduceRun.mockResolvedValueOnce();

		await expect(
			actions.default({
				request: requestWithForm([
					['run_id', '77'],
					['rolls_to_unproduce', '2'],
					['selected_date', '2026-05-01'],
					['return_to', '/production?status=completed'],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location:
				'/production/unproduce?date=2026-05-01&returnTo=%2Fproduction%3Fstatus%3Dcompleted',
		});

		expect(unproduceRun).toHaveBeenCalledWith(77, 2, 9);
	});

	it('falls back to production when return_to is unsafe', async () => {
		unproduceRun.mockResolvedValueOnce();

		await expect(
			actions.default({
				request: requestWithForm([
					['run_id', '77'],
					['rolls_to_unproduce', '2'],
					['return_to', 'https://example.com'],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/production/unproduce?returnTo=%2Fproduction',
		});
	});
});
