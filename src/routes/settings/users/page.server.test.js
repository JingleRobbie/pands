import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, hash } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
	hash: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('bcryptjs', () => ({
	default: { hash },
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

describe('settings users page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('redirects non-admin users away from user management', async () => {
		await expect(load({ locals: { appUser: { id: 7, role: 'operator' } } })).rejects.toEqual({
			type: 'redirect',
			status: 302,
			location: '/settings',
		});
		expect(db.query).not.toHaveBeenCalled();
	});

	it('loads users for admins', async () => {
		const appUser = { id: 7, role: 'admin' };
		const users = [{ id: 7, display_name: 'Admin', role: 'admin', is_active: 1 }];
		db.query.mockResolvedValueOnce([users]);

		const result = await load({ locals: { appUser } });

		expect(result).toEqual({ users, appUser });
		expect(db.query).toHaveBeenCalledWith(
			'SELECT id, display_name, role, is_active FROM app_users ORDER BY display_name'
		);
	});

	it('validates create user input before hashing', async () => {
		const result = await actions.create({
			request: requestWithForm([
				['display_name', ''],
				['role', 'admin'],
				['password', 'secret'],
			]),
		});

		expect(result).toEqual({ status: 400, data: { createError: 'Name is required.' } });
		expect(hash).not.toHaveBeenCalled();
		expect(db.query).not.toHaveBeenCalled();
	});

	it('creates a user with a hashed password', async () => {
		hash.mockResolvedValueOnce('hashed-secret');
		db.query.mockResolvedValueOnce([{}]);

		const result = await actions.create({
			request: requestWithForm([
				['display_name', ' Operator '],
				['role', 'operator'],
				['password', 'secret'],
			]),
		});

		expect(result).toEqual({ created: true });
		expect(hash).toHaveBeenCalledWith('secret', 12);
		expect(db.query).toHaveBeenCalledWith(
			'INSERT INTO app_users (display_name, role, password_hash) VALUES (?, ?, ?)',
			['Operator', 'operator', 'hashed-secret']
		);
	});

	it('returns a friendly duplicate-name error when creating a user', async () => {
		hash.mockResolvedValueOnce('hashed-secret');
		db.query.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

		const result = await actions.create({
			request: requestWithForm([
				['display_name', 'Operator'],
				['role', 'operator'],
				['password', 'secret'],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: { createError: 'A user with that name already exists.' },
		});
	});

	it('prevents users from deactivating their own account', async () => {
		const result = await actions.update({
			locals: { appUser: { id: 7 } },
			request: requestWithForm([
				['id', '7'],
				['display_name', 'Admin'],
				['role', 'admin'],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: {
				updateError: 'You cannot deactivate your own account.',
				updateId: 7,
			},
		});
		expect(db.query).not.toHaveBeenCalled();
	});

	it('updates a user profile and active state', async () => {
		db.query.mockResolvedValueOnce([{}]);

		const result = await actions.update({
			locals: { appUser: { id: 7 } },
			request: requestWithForm([
				['id', '8'],
				['display_name', ' Operator '],
				['role', 'operator'],
				['is_active', 'on'],
			]),
		});

		expect(result).toEqual({ updated: true, updatedId: 8 });
		expect(db.query).toHaveBeenCalledWith(
			'UPDATE app_users SET display_name=?, role=?, is_active=? WHERE id=?',
			['Operator', 'operator', 1, 8]
		);
	});

	it('requires a password before resetting one', async () => {
		const result = await actions.set_password({
			request: requestWithForm([
				['id', '8'],
				['password', ''],
			]),
		});

		expect(result).toEqual({
			status: 400,
			data: { pwError: 'Password is required.', pwId: 8 },
		});
		expect(hash).not.toHaveBeenCalled();
		expect(db.query).not.toHaveBeenCalled();
	});

	it('hashes and stores password resets', async () => {
		hash.mockResolvedValueOnce('hashed-secret');
		db.query.mockResolvedValueOnce([{}]);

		const result = await actions.set_password({
			request: requestWithForm([
				['id', '8'],
				['password', 'secret'],
			]),
		});

		expect(result).toEqual({ passwordReset: true, pwId: 8 });
		expect(hash).toHaveBeenCalledWith('secret', 12);
		expect(db.query).toHaveBeenCalledWith('UPDATE app_users SET password_hash=? WHERE id=?', [
			'hashed-secret',
			8,
		]);
	});
});
