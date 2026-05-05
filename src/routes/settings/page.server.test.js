import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('@sveltejs/kit', () => ({
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { actions, load } = await import('./+page.server.js');

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

describe('settings page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads the current app user', () => {
		const appUser = { id: 7, display_name: 'Admin', role: 'admin' };

		expect(load({ locals: { appUser } })).toEqual({ appUser });
	});

	it('stores collapsed sidebar preference and redirects to the matrix', async () => {
		db.query.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				locals: { appUser: { id: 7 } },
				request: requestWithForm([['sidebar_collapsed', 'on']]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/matrix' });

		expect(db.query).toHaveBeenCalledWith(
			'UPDATE app_users SET sidebar_collapsed = ? WHERE id = ?',
			[1, 7]
		);
	});

	it('stores expanded sidebar preference and redirects to the matrix', async () => {
		db.query.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				locals: { appUser: { id: 7 } },
				request: requestWithForm([]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/matrix' });

		expect(db.query).toHaveBeenCalledWith(
			'UPDATE app_users SET sidebar_collapsed = ? WHERE id = ?',
			[0, 7]
		);
	});
});
