import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revertShipment } = vi.hoisted(() => ({
	revertShipment: vi.fn(),
}));

vi.mock('$lib/auth.js', () => ({
	requireAdmin: vi.fn((locals) =>
		locals.appUser?.role === 'admin' ? null : { status: 403, data: { error: 'Admin only' } }
	),
}));
vi.mock('$lib/services/shipping.js', () => ({
	getShipment: vi.fn(),
	revertShipment,
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

describe('shipment detail actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('revert', () => {
		it('rejects non-admin users before calling the service', async () => {
			const result = await actions.revert({
				params: { id: '123' },
				request: requestWithForm([['return_to', '/shipments']]),
				locals: { appUser: { id: 9, role: 'user' } },
			});

			expect(result).toEqual({ status: 403, data: { error: 'Admin only' } });
			expect(revertShipment).not.toHaveBeenCalled();
		});

		it('reverts the shipment and redirects with returnTo preserved', async () => {
			revertShipment.mockResolvedValueOnce();

			await expect(
				actions.revert({
					params: { id: '123' },
					request: requestWithForm([['return_to', '/shipments?status=shipped']]),
					locals: { appUser: { id: 9, role: 'admin' } },
				})
			).rejects.toEqual({
				type: 'redirect',
				status: 303,
				location: '/shipments/123?reverted=1&returnTo=%2Fshipments%3Fstatus%3Dshipped',
			});

			expect(revertShipment).toHaveBeenCalledWith('123');
		});

		it('returns a user-facing failure when revert is rejected', async () => {
			revertShipment.mockRejectedValueOnce(new Error('Database unavailable'));

			const result = await actions.revert({
				params: { id: '123' },
				request: requestWithForm([['return_to', '/shipments']]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({ status: 500, data: { error: 'Database unavailable' } });
		});

		it('falls back to shipments when return_to is unsafe', async () => {
			revertShipment.mockResolvedValueOnce();

			await expect(
				actions.revert({
					params: { id: '123' },
					request: requestWithForm([['return_to', 'https://example.com']]),
					locals: { appUser: { id: 9, role: 'admin' } },
				})
			).rejects.toEqual({
				type: 'redirect',
				status: 303,
				location: '/shipments/123?reverted=1&returnTo=%2Fshipments',
			});
		});
	});
});
