import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compare, db } = vi.hoisted(() => ({
	compare: vi.fn(),
	db: {
		query: vi.fn(),
	},
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('bcryptjs', () => ({
	default: { compare },
}));

vi.mock('@sveltejs/kit', () => ({
	fail: vi.fn((status, data) => ({ status, data })),
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

describe('login page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('redirects already-authenticated users during load', async () => {
		await expect(load({ locals: { appUser: { id: 7 } } })).rejects.toEqual({
			type: 'redirect',
			status: 302,
			location: '/calendar',
		});
		expect(db.query).not.toHaveBeenCalled();
	});

	it('loads active users for the picker', async () => {
		const users = [{ id: 7, display_name: 'Admin' }];
		db.query.mockResolvedValueOnce([users]);

		const result = await load({ locals: {} });

		expect(result).toEqual({ users });
		expect(db.query).toHaveBeenCalledWith(
			'SELECT id, display_name FROM app_users WHERE is_active = TRUE ORDER BY display_name'
		);
	});

	it('redirects already-authenticated users during login action', async () => {
		await expect(
			actions.default({
				locals: { appUser: { id: 7 } },
				request: requestWithForm([]),
			})
		).rejects.toEqual({ type: 'redirect', status: 302, location: '/calendar' });
		expect(db.query).not.toHaveBeenCalled();
	});

	it('requires selecting a user before querying credentials', async () => {
		const result = await actions.default({
			cookies: { set: vi.fn() },
			locals: {},
			request: requestWithForm([['password', 'secret']]),
		});

		expect(result).toEqual({ status: 400, data: { error: 'Please select a user.' } });
		expect(db.query).not.toHaveBeenCalled();
	});

	it('rejects users without a password hash', async () => {
		db.query.mockResolvedValueOnce([[{ id: 7, password_hash: null }]]);

		const result = await actions.default({
			cookies: { set: vi.fn() },
			locals: {},
			request: requestWithForm([
				['user_id', '7'],
				['password', 'secret'],
			]),
		});

		expect(result).toEqual({ status: 401, data: { error: 'Invalid credentials.' } });
		expect(compare).not.toHaveBeenCalled();
	});

	it('rejects invalid passwords', async () => {
		db.query.mockResolvedValueOnce([[{ id: 7, password_hash: 'hashed-secret' }]]);
		compare.mockResolvedValueOnce(false);

		const result = await actions.default({
			cookies: { set: vi.fn() },
			locals: {},
			request: requestWithForm([
				['user_id', '7'],
				['password', 'wrong'],
			]),
		});

		expect(result).toEqual({ status: 401, data: { error: 'Invalid credentials.' } });
		expect(compare).toHaveBeenCalledWith('wrong', 'hashed-secret');
	});

	it('sets the app user cookie and redirects after valid credentials', async () => {
		const cookies = { set: vi.fn() };
		db.query.mockResolvedValueOnce([[{ id: 7, password_hash: 'hashed-secret' }]]);
		compare.mockResolvedValueOnce(true);

		await expect(
			actions.default({
				cookies,
				locals: {},
				request: requestWithForm([
					['user_id', '7'],
					['password', 'secret'],
				]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/calendar' });

		expect(cookies.set).toHaveBeenCalledWith('app_user_id', '7', {
			path: '/',
			maxAge: 60 * 60 * 24 * 30,
			httpOnly: true,
			sameSite: 'lax',
		});
	});
});
