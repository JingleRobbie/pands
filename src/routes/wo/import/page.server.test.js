import { beforeEach, describe, expect, it, vi } from 'vitest';

const { conn, db } = vi.hoisted(() => ({
	conn: {
		beginTransaction: vi.fn(),
		commit: vi.fn(),
		query: vi.fn(),
		release: vi.fn(),
		rollback: vi.fn(),
	},
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
vi.mock('$lib/parseWO.js', () => ({
	parseWorkOrderExcel: vi.fn(),
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

describe('work order import page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		db.getConnection.mockResolvedValue(conn);
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

	it('imports accepted new work orders and skips unaccepted preview rows', async () => {
		conn.query
			.mockResolvedValueOnce([[{ id: 44 }]])
			.mockResolvedValueOnce([{ insertId: 101 }])
			.mockResolvedValue([{}]);
		const acceptedWo = {
			so_number: 'SO-100',
			customer_name: 'Acme',
			job_name: 'North Wing',
			branch: 'Tulsa',
			ship_date: '2026-05-15',
			ship_addr1: '123 Main St',
			ship_city: 'Tulsa',
			ship_state: 'OK',
			ship_zip: '74101',
			status: 'new',
			contact_name: 'Sam',
			contact_phone: '555-1000',
			accessories: [{ qty: 2, part_number: 'PIN-1', description: 'Pins' }],
			lines: [
				{
					sku_id: 7,
					thickness_in: 3,
					width_in: 48,
					qty: 4,
					length_ft: 100,
					sqft: 1600,
					rollfor: 'Wall',
					facing: 'FSK',
					instructions: 'Label A',
					tab_type: 'A',
				},
			],
		};
		const skippedWo = {
			so_number: 'SO-200',
			customer_name: 'Beta',
			job_name: 'South Wing',
			branch: 'OKC',
			ship_date: '2026-05-20',
			status: 'new',
			lines: [],
		};

		const result = await actions.import({
			request: requestWithForm([
				['accepted', 'SO-100'],
				['csv_data', JSON.stringify([acceptedWo, skippedWo])],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ success: true, created: 1, updated: 0 });
		expect(db.getConnection).toHaveBeenCalledOnce();
		expect(conn.beginTransaction).toHaveBeenCalledOnce();
		expect(conn.query).toHaveBeenNthCalledWith(
			1,
			'SELECT id FROM customers WHERE LOWER(name) = LOWER(?)',
			['Acme']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			2,
			'INSERT INTO work_orders (so_number, customer_name, job_name, branch, ship_date, customer_id, ship_addr1, ship_city, ship_state, ship_zip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[
				'SO-100',
				'Acme',
				'North Wing',
				'Tulsa',
				'2026-05-15',
				44,
				'123 Main St',
				'Tulsa',
				'OK',
				'74101',
			]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			3,
			'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions, tab_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[101, 7, 3, 48, 4, 100, 1600, 'Wall', 'FSK', 'Label A', 'A']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			4,
			'INSERT INTO contacts (wo_id, name, phone) VALUES (?, ?, ?)',
			[101, 'Sam', '555-1000']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			5,
			'INSERT INTO wo_accessories (wo_id, qty, part_number, description) VALUES (?, ?, ?, ?)',
			[101, 2, 'PIN-1', 'Pins']
		);
		expect(conn.query).toHaveBeenCalledTimes(5);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('rolls back, releases the connection, and returns an error when import fails', async () => {
		conn.query.mockRejectedValueOnce(new Error('database unavailable'));

		const result = await actions.import({
			request: requestWithForm([
				['accepted', 'SO-100'],
				[
					'csv_data',
					JSON.stringify([
						{
							so_number: 'SO-100',
							customer_name: 'Acme',
							job_name: 'North Wing',
							branch: 'Tulsa',
							ship_date: '2026-05-15',
							status: 'new',
							lines: [],
						},
					]),
				],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ status: 500, data: { error: 'database unavailable' } });
		expect(conn.beginTransaction).toHaveBeenCalledOnce();
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.rollback).toHaveBeenCalledOnce();
		expect(conn.release).toHaveBeenCalledOnce();
	});
});
