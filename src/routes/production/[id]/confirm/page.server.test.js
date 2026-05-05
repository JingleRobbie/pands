import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmRun } = vi.hoisted(() => ({
	confirmRun: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db: { query: vi.fn() } }));
vi.mock('$lib/services/inventory.js', () => ({ getMatrixDataForSkus: vi.fn() }));
vi.mock('$lib/services/production.js', () => ({ confirmRun }));

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

describe('production confirm action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects missing or invalid actual roll counts before calling the service', async () => {
		const result = await actions.default({
			params: { id: '77' },
			request: requestWithForm([
				['return_to', '/production'],
				['rolls_actual', '0'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Enter a valid roll count.' } });
		expect(confirmRun).not.toHaveBeenCalled();
	});

	it('returns a user-facing failure when the service rejects confirmation', async () => {
		confirmRun.mockRejectedValueOnce(new Error('This run is already completed.'));

		const result = await actions.default({
			params: { id: '77' },
			request: requestWithForm([
				['return_to', '/production'],
				['rolls_actual', '2'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(confirmRun).toHaveBeenCalledWith(77, 2, 9);
		expect(result).toEqual({
			status: 400,
			data: { error: 'This run is already completed.' },
		});
	});

	it('confirms the run and redirects to a safe return path', async () => {
		confirmRun.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '77' },
				request: requestWithForm([
					['return_to', '/production?status=scheduled'],
					['rolls_actual', '2'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/production?status=scheduled',
		});

		expect(confirmRun).toHaveBeenCalledWith(77, 2, 9);
	});

	it('falls back to production when return_to is unsafe', async () => {
		confirmRun.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '77' },
				request: requestWithForm([
					['return_to', 'https://example.com'],
					['rolls_actual', '2'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/production',
		});
	});
});
