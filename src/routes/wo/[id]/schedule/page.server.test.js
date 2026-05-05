import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scheduleGroup } = vi.hoisted(() => ({
	scheduleGroup: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db: { query: vi.fn() } }));
vi.mock('$lib/services/production.js', () => ({ scheduleGroup }));

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

describe('work order schedule action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('requires a production date before calling the service', async () => {
		const result = await actions.default({
			params: { id: '22' },
			request: requestWithForm([
				['return_to', '/wo'],
				['line_id', '55'],
				['rolls', '2'],
				['run_date', ''],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Production date is required.' } });
		expect(scheduleGroup).not.toHaveBeenCalled();
	});

	it('requires at least one positive roll count before calling the service', async () => {
		const result = await actions.default({
			params: { id: '22' },
			request: requestWithForm([
				['return_to', '/wo'],
				['line_id', '55'],
				['rolls', '0'],
				['run_date', '2026-05-01'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Enter a roll count for at least one line.' },
		});
		expect(scheduleGroup).not.toHaveBeenCalled();
	});

	it('schedules positive line quantities and redirects back to the work order', async () => {
		scheduleGroup.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '22' },
				request: requestWithForm([
					['return_to', '/production?status=open'],
					['line_id', '55'],
					['rolls', '2'],
					['line_id', '56'],
					['rolls', '0'],
					['line_id', '57'],
					['rolls', '3'],
					['run_date', '2026-05-01'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/wo/22?returnTo=%2Fproduction%3Fstatus%3Dopen',
		});

		expect(scheduleGroup).toHaveBeenCalledWith(
			22,
			[
				{ woLineId: 55, rollsScheduled: 2 },
				{ woLineId: 57, rollsScheduled: 3 },
			],
			'2026-05-01',
			9
		);
	});

	it('returns a user-facing failure when scheduling is rejected', async () => {
		scheduleGroup.mockRejectedValueOnce(
			new Error('Cannot schedule 4 rolls for line 55 - only 3 remaining.')
		);

		const result = await actions.default({
			params: { id: '22' },
			request: requestWithForm([
				['return_to', '/wo'],
				['line_id', '55'],
				['rolls', '4'],
				['run_date', '2026-05-01'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 500,
			data: { error: 'Cannot schedule 4 rolls for line 55 - only 3 remaining.' },
		});
	});

	it('falls back to the work order detail when return_to is unsafe', async () => {
		scheduleGroup.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '22' },
				request: requestWithForm([
					['return_to', 'https://example.com'],
					['line_id', '55'],
					['rolls', '2'],
					['run_date', '2026-05-01'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/wo/22?returnTo=%2Fwo%2F22',
		});
	});
});
