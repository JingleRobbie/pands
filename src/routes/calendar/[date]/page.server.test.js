import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, deleteRun, scheduleRun } = vi.hoisted(() => ({
	db: { query: vi.fn() },
	deleteRun: vi.fn(),
	scheduleRun: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/services/production.js', () => ({ deleteRun, scheduleRun }));
vi.mock('$lib/auth.js', () => ({
	requireAdmin: vi.fn((locals) =>
		locals.appUser?.role === 'admin' ? null : { status: 403, data: { error: 'Admin only' } }
	),
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

describe('calendar day page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads scheduled runs and available work order lines for the date', async () => {
		const runs = [{ id: 1, run_number: 'R-1' }];
		const available = [{ id: 100, sku_label: '3 x 48' }];
		db.query.mockResolvedValueOnce([runs]).mockResolvedValueOnce([available]);

		const result = await load({
			params: { date: '2026-05-05' },
			locals: { appUser: { id: 9, name: 'Alex' } },
		});

		expect(db.query).toHaveBeenCalledTimes(2);
		expect(db.query.mock.calls[0][0]).toContain('WHERE pr.run_date = ?');
		expect(db.query.mock.calls[0][1]).toEqual(['2026-05-05']);
		expect(db.query.mock.calls[1][0]).toContain("WHERE wo.status NOT IN ('COMPLETE', 'CANCELLED')");
		expect(result).toEqual({
			date: '2026-05-05',
			runs,
			available,
			user: { id: 9, name: 'Alex' },
		});
	});

	it('rejects invalid schedule roll counts before calling the service', async () => {
		const result = await actions.schedule({
			params: { date: '2026-05-05' },
			request: requestWithForm([
				['wo_line_id', '100'],
				['rolls', '0'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Enter a valid roll count.' } });
		expect(scheduleRun).not.toHaveBeenCalled();
	});

	it('schedules a run and redirects back to the calendar day', async () => {
		scheduleRun.mockResolvedValueOnce();

		await expect(
			actions.schedule({
				params: { date: '2026-05-05' },
				request: requestWithForm([
					['wo_line_id', '100'],
					['rolls', '3'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/calendar/2026-05-05',
		});

		expect(scheduleRun).toHaveBeenCalledWith(100, '2026-05-05', 3, 9);
	});

	it('returns a user-facing failure when scheduling is rejected', async () => {
		scheduleRun.mockRejectedValueOnce(new Error('Not enough rolls remaining.'));

		const result = await actions.schedule({
			params: { date: '2026-05-05' },
			request: requestWithForm([
				['wo_line_id', '100'],
				['rolls', '3'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 500, data: { error: 'Not enough rolls remaining.' } });
	});

	it('rejects delete for non-admin users before calling the service', async () => {
		const result = await actions.delete({
			params: { date: '2026-05-05' },
			request: requestWithForm([['run_id', '77']]),
			locals: { appUser: { id: 9, role: 'user' } },
		});

		expect(result).toEqual({ status: 403, data: { error: 'Admin only' } });
		expect(deleteRun).not.toHaveBeenCalled();
	});

	it('deletes a run and redirects back to the calendar day for admins', async () => {
		deleteRun.mockResolvedValueOnce();

		await expect(
			actions.delete({
				params: { date: '2026-05-05' },
				request: requestWithForm([['run_id', '77']]),
				locals: { appUser: { id: 9, role: 'admin' } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/calendar/2026-05-05',
		});

		expect(deleteRun).toHaveBeenCalledWith(77);
	});
});
