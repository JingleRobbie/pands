import { beforeEach, describe, expect, it, vi } from 'vitest';

const { conn, mockDb } = vi.hoisted(() => {
	const conn = {
		beginTransaction: vi.fn(),
		commit: vi.fn(),
		query: vi.fn(),
		release: vi.fn(),
		rollback: vi.fn(),
	};

	return {
		conn,
		mockDb: {
			getConnection: vi.fn(() => conn),
		},
	};
});

vi.mock('$lib/db.js', () => ({ db: mockDb }));

const { __cutdownTest, confirmCutDown, scheduleCutDown, scheduleCutDownGroup } =
	await import('./cutdown.js');

describe('cut-down raw roll helpers', () => {
	it.each([
		['R-11 JM exception', 'R-11', 3.5, 48, 'Johns Manville', 75],
		['R-11 CT exception', 'R-11', 3.5, 48, 'Certainteed', 100],
		['R-30 JM exception', 'R-30', 9.5, 60, 'Johns Manville', 27],
		['R-30 CT exception', 'R-30', 9.5, 60, 'Certainteed', 25],
		['R-19 common length', 'R-19', 6, 48, 'Johns Manville', 50],
		['R-19 common CT length', 'R-19', 6, 48, 'Certainteed', 50],
	])(
		'calculates scheduled source sqft for %s',
		(_label, rValue, thickness, width, vendor, length) => {
			const sqftPerRoll = (width / 12) * length;
			const result = __cutdownTest.calcScheduledRawRolls(
				{ sqft: sqftPerRoll + 1 },
				{
					r_value: rValue,
					thickness_in: thickness,
					width_in: width,
					vendor,
					roll_length_ft: length,
				}
			);

			expect(result).toEqual({
				rollsScheduled: 2,
				sqftScheduled: sqftPerRoll * 2,
			});
		}
	);

	it('calculates actual consumption from raw roll dimensions', () => {
		expect(
			__cutdownTest.calcRawRollSqft({ raw_roll_width_in: 60, raw_roll_length_ft: 75 }, 2)
		).toBe(750);
	});
});

describe('cut-down services', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('schedules rounded raw source sqft without changing billing line sqft', async () => {
		conn.query
			.mockResolvedValueOnce([
				[
					{
						id: 34,
						wo_id: 12,
						sku_id: 7,
						parent_line_id: null,
						thickness_in: 3.5,
						width_in: 48,
						sqft: 401,
					},
				],
			])
			.mockResolvedValueOnce([[{ childCount: 2 }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([
				[
					{
						id: 5,
						vendor: 'Johns Manville',
						r_value: 'R-11',
						thickness_in: 3.5,
						width_in: 48,
						roll_length_ft: 75,
					},
				],
			])
			.mockResolvedValueOnce([[{ last: 'CD-000009' }]])
			.mockResolvedValueOnce([{}]);

		await expect(scheduleCutDown(34, 'JM', '2026-05-10', 9)).resolves.toBe('CD-000010');

		expect(conn.query).toHaveBeenNthCalledWith(
			4,
			expect.stringContaining('rrl.r_value = ms.r_value'),
			[7, 'Johns Manville', 3.5, 48]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			6,
			expect.stringContaining('INSERT INTO cut_downs'),
			[
				'CD-000010',
				12,
				34,
				7,
				'2026-05-10',
				'SCHEDULED',
				2,
				5,
				'Johns Manville',
				75,
				48,
				600,
				9,
			]
		);
		expect(
			conn.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE work_order_lines'))
		).toBe(false);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('blocks single-line scheduling when an active cut-down already exists', async () => {
		conn.query
			.mockResolvedValueOnce([
				[
					{
						id: 34,
						wo_id: 12,
						sku_id: 7,
						parent_line_id: null,
						thickness_in: 3.5,
						width_in: 48,
						sqft: 401,
					},
				],
			])
			.mockResolvedValueOnce([[{ childCount: 2 }]])
			.mockResolvedValueOnce([[{ id: 22 }]]);

		await expect(scheduleCutDown(34, 'JM', '2026-05-10', 9)).rejects.toThrow(
			'An active cut-down already exists for this line. Delete it first.'
		);

		expect(
			conn.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO cut_downs'))
		).toBe(false);
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.rollback).toHaveBeenCalledOnce();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('rejects duplicate billing lines inside a group schedule request', async () => {
		await expect(
			scheduleCutDownGroup(
				12,
				[
					{ billingLineId: 34, vendor: 'JM' },
					{ billingLineId: 34, vendor: 'CT' },
				],
				'2026-05-10',
				9
			)
		).rejects.toThrow('Line 34 was selected more than once.');

		expect(conn.query).not.toHaveBeenCalled();
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.rollback).toHaveBeenCalledOnce();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('blocks group scheduling when a selected line already has an active cut-down', async () => {
		conn.query.mockResolvedValueOnce([[{ wo_id: 12 }]]).mockResolvedValueOnce([[{ id: 22 }]]);

		await expect(
			scheduleCutDownGroup(12, [{ billingLineId: 34, vendor: 'JM' }], '2026-05-10', 9)
		).rejects.toThrow('An active cut-down already exists for line 34. Delete it first.');

		expect(conn.query.mock.calls.some(([sql]) => String(sql).includes('cut_down_groups'))).toBe(
			false
		);
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.rollback).toHaveBeenCalledOnce();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('schedules a clean multi-line cut-down group', async () => {
		conn.query
			.mockResolvedValueOnce([[{ wo_id: 12 }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([[{ wo_id: 12 }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([{ insertId: 88 }])
			.mockResolvedValueOnce([
				[
					{
						id: 34,
						wo_id: 12,
						sku_id: 7,
						thickness_in: 3.5,
						width_in: 48,
						sqft: 401,
					},
				],
			])
			.mockResolvedValueOnce([
				[
					{
						id: 5,
						vendor: 'Johns Manville',
						r_value: 'R-11',
						thickness_in: 3.5,
						width_in: 48,
						roll_length_ft: 75,
					},
				],
			])
			.mockResolvedValueOnce([[{ last: 'CD-000009' }]])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([
				[
					{
						id: 35,
						wo_id: 12,
						sku_id: 8,
						thickness_in: 3.5,
						width_in: 60,
						sqft: 376,
					},
				],
			])
			.mockResolvedValueOnce([
				[
					{
						id: 6,
						vendor: 'Certainteed',
						r_value: 'R-11',
						thickness_in: 3.5,
						width_in: 60,
						roll_length_ft: 100,
					},
				],
			])
			.mockResolvedValueOnce([[{ last: 'CD-000010' }]])
			.mockResolvedValueOnce([{}]);

		await expect(
			scheduleCutDownGroup(
				12,
				[
					{ billingLineId: 34, vendor: 'JM' },
					{ billingLineId: 35, vendor: 'CT' },
				],
				'2026-05-10',
				9
			)
		).resolves.toBe(88);

		expect(conn.query).toHaveBeenNthCalledWith(
			9,
			expect.stringContaining('INSERT INTO cut_downs'),
			[
				'CD-000010',
				88,
				12,
				34,
				7,
				'2026-05-10',
				'SCHEDULED',
				2,
				5,
				'Johns Manville',
				75,
				48,
				600,
				9,
			]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			13,
			expect.stringContaining('INSERT INTO cut_downs'),
			[
				'CD-000011',
				88,
				12,
				35,
				8,
				'2026-05-10',
				'SCHEDULED',
				1,
				6,
				'Certainteed',
				100,
				60,
				500,
				9,
			]
		);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('uses raw source sqft when confirming with blank actual sqft and saves overage as WIP', async () => {
		conn.query
			.mockResolvedValueOnce([
				[
					{
						id: 22,
						billing_line_id: 34,
						sku_id: 7,
						cut_down_number: 'CD-000022',
						status: 'SCHEDULED',
						rolls_scheduled: 2,
						raw_roll_width_in: 60,
						raw_roll_length_ft: 75,
					},
				],
			])
			.mockResolvedValueOnce([
				[
					{
						id: 34,
						width_in: 60,
						sqft: 600,
						so_number: 'SO-1',
						job_name: 'Shop',
					},
				],
			])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([[{ id: 44, width_in: 48 }]])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([{}]);

		await expect(confirmCutDown(22, 2, null, null, 'SAVED', 'keep it', 9)).resolves.toEqual({
			cutDownId: 22,
			sqftActual: 750,
			scrapDisposition: 'SAVED',
		});

		expect(conn.query).toHaveBeenNthCalledWith(
			3,
			expect.stringContaining('INSERT INTO inventory_transactions'),
			[7, 750, 22, expect.stringContaining('SO-1 Shop'), 9]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			5,
			expect.stringContaining('INSERT INTO wip_ledger'),
			['CUT_IN', 22, 44, 48, 600, expect.any(String), expect.stringContaining('48" cut'), 9]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			6,
			expect.stringContaining('INSERT INTO wip_ledger'),
			[
				'SCRAP',
				22,
				null,
				60,
				150,
				expect.any(String),
				expect.stringContaining('scrap saved'),
				9,
			]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			7,
			expect.not.stringContaining('source_roll_count'),
			[2, 750, null, 'SAVED', 'keep it', 9, 22]
		);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
	});

	it('writes a scrap-off entry when overage is discarded', async () => {
		conn.query
			.mockResolvedValueOnce([
				[
					{
						id: 22,
						billing_line_id: 34,
						sku_id: 7,
						cut_down_number: 'CD-000022',
						status: 'SCHEDULED',
						rolls_scheduled: 2,
						raw_roll_width_in: 60,
						raw_roll_length_ft: 75,
					},
				],
			])
			.mockResolvedValueOnce([
				[
					{
						id: 34,
						width_in: 60,
						sqft: 600,
						so_number: 'SO-1',
						job_name: 'Shop',
					},
				],
			])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([[{ id: 44, width_in: 48 }]])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([{}]);

		await confirmCutDown(22, 2, null, null, 'DISCARDED', null, 9);

		expect(conn.query).toHaveBeenNthCalledWith(
			7,
			expect.stringContaining('INSERT INTO wip_ledger'),
			[
				'SCRAP',
				22,
				null,
				60,
				-150,
				expect.any(String),
				expect.stringContaining('scrap discarded'),
				9,
			]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			8,
			expect.not.stringContaining('source_roll_count'),
			[2, 750, null, 'DISCARDED', null, 9, 22]
		);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
	});
});
