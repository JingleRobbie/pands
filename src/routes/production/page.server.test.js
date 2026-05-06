import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: { query: vi.fn() },
}));

vi.mock('$lib/db.js', () => ({ db }));

const { load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/production${search}`);
}

describe('production list load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-05T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('defaults to pending runs grouped by work order and SKU/facing', async () => {
		const runRows = [
			{
				id: 1,
				run_date: '2026-05-04',
				rolls_scheduled: 2,
				sqft_scheduled: 200,
				status: 'SCHEDULED',
				display_label: '3 x 48',
				facing: 'Unfaced',
				wo_id: 10,
				so_number: 'SO-10',
				job_name: 'North',
				customer_name: 'Acme',
			},
			{
				id: 2,
				run_date: '2026-05-04',
				rolls_scheduled: 1,
				sqft_scheduled: 100,
				status: 'UNSCHEDULED',
				display_label: '3 x 48',
				facing: 'Unfaced',
				wo_id: 10,
				so_number: 'SO-10',
				job_name: 'North',
				customer_name: 'Acme',
			},
			{
				id: 3,
				run_date: '2026-05-05',
				rolls_scheduled: 4,
				sqft_scheduled: 400,
				status: 'SCHEDULED',
				display_label: '4 x 48',
				facing: 'Faced',
				wo_id: 11,
				so_number: 'SO-11',
				job_name: 'South',
				customer_name: 'Beta',
			},
		];
		db.query.mockResolvedValueOnce([runRows]);

		const result = await load({
			locals: { appUser: { id: 9, name: 'Alex' } },
			url: urlWithSearch(),
		});

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain("pr.status != 'COMPLETED'");
		expect(db.query.mock.calls[0][1]).toEqual([]);
		expect(result).toEqual({
			woGroups: [
				{
					wo_id: 10,
					so_number: 'SO-10',
					job_name: 'North',
					customer_name: 'Acme',
					skuLines: [
						{
							display_label: '3 x 48',
							facing: 'Unfaced',
							total_rolls: 3,
							total_sqft: 300,
							status: 'UNSCHEDULED',
						},
					],
					first_pending_run_id: 1,
					minDate: '2026-05-04',
					urgency: 'overdue',
				},
				{
					wo_id: 11,
					so_number: 'SO-11',
					job_name: 'South',
					customer_name: 'Beta',
					skuLines: [
						{
							display_label: '4 x 48',
							facing: 'Faced',
							total_rolls: 4,
							total_sqft: 400,
							status: 'SCHEDULED',
						},
					],
					first_pending_run_id: 3,
					minDate: '2026-05-05',
					urgency: 'today',
				},
			],
			today: '2026-05-05',
			q: '',
			status: '',
			from: '',
			user: { id: 9, name: 'Alex' },
		});
	});

	it('normalizes completed search filters and defaults invalid from dates', async () => {
		db.query.mockResolvedValueOnce([[]]);

		const result = await load({
			locals: { appUser: { id: 10 } },
			url: urlWithSearch('?status=completed&q=%20SO-10%20&from=not-a-date'),
		});

		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query.mock.calls[0][0]).toContain('pr.status = ?');
		expect(db.query.mock.calls[0][0]).toContain(
			'(pr.run_number LIKE ? OR wo.job_name LIKE ? OR wo.so_number LIKE ?)'
		);
		expect(db.query.mock.calls[0][0]).toContain('COALESCE(DATE(pr.confirmed_at), pr.run_date) >= ?');
		expect(db.query.mock.calls[0][1]).toEqual([
			'COMPLETED',
			'%SO-10%',
			'%SO-10%',
			'%SO-10%',
			'2026-02-04',
		]);
		expect(result).toEqual({
			woGroups: [],
			today: '2026-05-05',
			q: 'SO-10',
			status: 'completed',
			from: '2026-02-04',
			user: { id: 10 },
		});
	});
});
