import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: {
		getConnection: vi.fn(),
		query: vi.fn(),
	},
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/auth.js', () => ({
	requireAdmin: vi.fn((locals) =>
		locals.appUser?.role === 'admin' ? null : { status: 403, data: { error: 'Admin only' } }
	),
}));

vi.mock('@sveltejs/kit', () => ({
	fail: vi.fn((status, data) => ({ status, data })),
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

describe('purchase order import page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads the current user', async () => {
		const user = { id: 9, name: 'Alex' };

		const result = await load({ locals: { appUser: user } });

		expect(result).toEqual({ user });
	});

	it('requires an uploaded workbook before parsing', async () => {
		const result = await actions.parse({
			request: requestWithForm([]),
		});

		expect(result).toEqual({ status: 400, data: { error: 'No file selected.' } });
		expect(db.query).not.toHaveBeenCalled();
	});

	it('rejects non-admin users before importing', async () => {
		const result = await actions.import({
			request: requestWithForm([['csv_data', '[]']]),
			locals: { appUser: { id: 9, role: 'user' } },
		});

		expect(result).toEqual({ status: 403, data: { error: 'Admin only' } });
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('rejects invalid import data before opening a transaction', async () => {
		const result = await actions.import({
			request: requestWithForm([['csv_data', 'not json']]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Invalid import data.' } });
		expect(db.getConnection).not.toHaveBeenCalled();
	});
});
