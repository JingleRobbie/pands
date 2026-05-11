import { beforeEach, describe, expect, it, vi } from 'vitest';

const { conn, db, parseWorkOrderExcel } = vi.hoisted(() => ({
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
	parseWorkOrderExcel: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/auth.js', () => ({
	requireAdmin: vi.fn((locals) =>
		locals.appUser?.role === 'admin' ? null : { status: 403, data: { error: 'Admin only' } }
	),
}));
vi.mock('$lib/parseWO.js', () => ({ parseWorkOrderExcel }));

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

function makeFile(name, content = 'fakecontent') {
	return {
		name,
		size: content.length,
		arrayBuffer: async () => Buffer.from(content),
	};
}

function requestWithFile(file) {
	return {
		formData: async () => ({
			get: (key) => (key === 'excel' ? file : null),
			getAll: () => [],
		}),
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
					tab_type: '1 X 6" TAB',
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
			'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions, field_instructions, tab_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[101, 7, 3, 48, 4, 100, 1600, 'Wall', 'FSK', 'Label A', 'Label A', '1-6']
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

	it('updates accepted changed work orders and replaces child rows', async () => {
		conn.query.mockResolvedValueOnce([[{ id: 44 }]]).mockResolvedValue([{}]);
		const changedWo = {
			so_number: 'SO-100',
			customer_name: 'Acme',
			job_name: 'North Wing Revised',
			branch: 'Tulsa',
			ship_date: '2026-05-20',
			ship_addr1: '123 Main St',
			ship_city: 'Tulsa',
			ship_state: 'OK',
			ship_zip: '74101',
			status: 'changed',
			existing_id: 101,
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
					tab_type: '1 X 6" TAB',
				},
			],
		};

		const result = await actions.import({
			request: requestWithForm([
				['accepted', 'SO-100'],
				['csv_data', JSON.stringify([changedWo])],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ success: true, created: 0, updated: 1 });
		expect(conn.beginTransaction).toHaveBeenCalledOnce();
		expect(conn.query).toHaveBeenNthCalledWith(
			1,
			'SELECT id FROM customers WHERE LOWER(name) = LOWER(?)',
			['Acme']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			2,
			'UPDATE work_orders SET customer_name=?, job_name=?, branch=?, ship_date=?, customer_id=COALESCE(customer_id, ?), ship_addr1=?, ship_city=?, ship_state=?, ship_zip=? WHERE id=?',
			[
				'Acme',
				'North Wing Revised',
				'Tulsa',
				'2026-05-20',
				44,
				'123 Main St',
				'Tulsa',
				'OK',
				'74101',
				101,
			]
		);
		expect(conn.query).toHaveBeenNthCalledWith(3, 'DELETE FROM work_order_lines WHERE wo_id = ?', [
			101,
		]);
		expect(conn.query).toHaveBeenNthCalledWith(4, 'DELETE FROM contacts WHERE wo_id = ?', [
			101,
		]);
		expect(conn.query).toHaveBeenNthCalledWith(
			5,
			'DELETE FROM wo_accessories WHERE wo_id = ?',
			[101]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			6,
			'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions, field_instructions, tab_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[101, 7, 3, 48, 4, 100, 1600, 'Wall', 'FSK', 'Label A', 'Label A', '1-6']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			7,
			'INSERT INTO contacts (wo_id, name, phone) VALUES (?, ?, ?)',
			[101, 'Sam', '555-1000']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			8,
			'INSERT INTO wo_accessories (wo_id, qty, part_number, description) VALUES (?, ?, ?, ?)',
			[101, 2, 'PIN-1', 'Pins']
		);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	describe('parse action - SO number from filename', () => {
		const skuRows = [{ id: 7, thickness_in: 3, width_in: 48, display_label: '3"x48"' }];
		const baseHeader = {
			customer: 'Acme',
			job_name: 'North Wing',
			branch: 'Tulsa',
			deliver_on: null,
			delivery_address: null,
			contact: null,
			phone: null,
		};
		const baseLine = {
			row: 1,
			thickness: '3',
			width: '48',
			roll_qty: '4',
			length: '100',
			roll_for: '',
			facing: '',
			instructions: '',
			tab_type: '',
		};

		it('uses filename SO number when workbook header.so_number is blank', async () => {
			parseWorkOrderExcel.mockReturnValue({
				header: { ...baseHeader, so_number: '' },
				accessories: [],
				lines: [baseLine],
			});
			db.query.mockResolvedValueOnce([skuRows]).mockResolvedValueOnce([[null]]);

			const result = await actions.parse({
				request: requestWithFile(makeFile('SO-123 North Wing.xlsx')),
			});

			expect(result.preview[0].so_number).toBe('SO-123');
		});

		it('uses filename SO number even when workbook contains a different SO number', async () => {
			parseWorkOrderExcel.mockReturnValue({
				header: { ...baseHeader, so_number: 'WRONG-999' },
				accessories: [],
				lines: [baseLine],
			});
			db.query.mockResolvedValueOnce([skuRows]).mockResolvedValueOnce([[null]]);

			const result = await actions.parse({
				request: requestWithFile(makeFile('SO-123 North Wing.xlsx')),
			});

			expect(result.preview[0].so_number).toBe('SO-123');
		});

		it('queries existing WO detection with filename-derived SO number', async () => {
			parseWorkOrderExcel.mockReturnValue({
				header: { ...baseHeader, so_number: '' },
				accessories: [],
				lines: [baseLine],
			});
			db.query.mockResolvedValueOnce([skuRows]).mockResolvedValueOnce([[null]]);

			await actions.parse({
				request: requestWithFile(makeFile('SO-456 Job Name.xlsx')),
			});

			expect(db.query).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining('WHERE wo.so_number = ?'),
				['SO-456']
			);
		});

		it('returns fail(400) when filename produces no SO number', async () => {
			const result = await actions.parse({
				request: requestWithFile(makeFile('   ')),
			});

			expect(result).toEqual({
				status: 400,
				data: { error: 'SO number not found in file name.' },
			});
			expect(db.query).not.toHaveBeenCalled();
		});
	});

	describe('tab type normalization', () => {
		const skuRows = [{ id: 7, thickness_in: 3, width_in: 48, display_label: '3"x48"' }];
		const baseHeader = {
			customer: 'Acme',
			job_name: 'North Wing',
			branch: 'Tulsa',
			deliver_on: null,
			delivery_address: null,
			contact: null,
			phone: null,
		};
		const baseLine = {
			row: 1,
			thickness: '3',
			width: '48',
			roll_qty: '4',
			length: '100',
			roll_for: '',
			facing: 'FSK',
			instructions: '',
			tab_type: '',
		};

		it('normalizes workbook tab labels in the parse preview', async () => {
			parseWorkOrderExcel.mockReturnValue({
				header: { ...baseHeader, so_number: '' },
				accessories: [],
				lines: [
					{ ...baseLine, row: 1, tab_type: '1 X 6" TAB' },
					{ ...baseLine, row: 2, tab_type: '2 X 3" TAB' },
					{ ...baseLine, row: 3, tab_type: '2 X 9" TAB' },
				],
			});
			db.query.mockResolvedValueOnce([skuRows]).mockResolvedValueOnce([[null]]);

			const result = await actions.parse({
				request: requestWithFile(makeFile('SO-123 North Wing.xlsx')),
			});

			expect(result.preview[0].lines.map((line) => line.tab_type)).toEqual([
				'1-6',
				'2-3',
				'2-9',
			]);
		});

		it('clears tab type for Unfaced lines during parse', async () => {
			parseWorkOrderExcel.mockReturnValue({
				header: { ...baseHeader, so_number: '' },
				accessories: [],
				lines: [{ ...baseLine, facing: 'Unfaced', tab_type: '1 X 6" TAB' }],
			});
			db.query.mockResolvedValueOnce([skuRows]).mockResolvedValueOnce([[null]]);

			const result = await actions.parse({
				request: requestWithFile(makeFile('SO-123 North Wing.xlsx')),
			});

			expect(result.preview[0].lines[0].tab_type).toBeNull();
		});

		it('normalizes blank and N/A tab values to null during parse', async () => {
			parseWorkOrderExcel.mockReturnValue({
				header: { ...baseHeader, so_number: '' },
				accessories: [],
				lines: [
					{ ...baseLine, row: 1, tab_type: '' },
					{ ...baseLine, row: 2, tab_type: 'N/A' },
				],
			});
			db.query.mockResolvedValueOnce([skuRows]).mockResolvedValueOnce([[null]]);

			const result = await actions.parse({
				request: requestWithFile(makeFile('SO-123 North Wing.xlsx')),
			});

			expect(result.preview[0].lines.map((line) => line.tab_type)).toEqual([null, null]);
		});

		it('rejects unknown tab text on a faced line during parse', async () => {
			parseWorkOrderExcel.mockReturnValue({
				header: { ...baseHeader, so_number: '' },
				accessories: [],
				lines: [{ ...baseLine, row: 42, tab_type: 'Custom Tab' }],
			});
			db.query.mockResolvedValueOnce([skuRows]);

			const result = await actions.parse({
				request: requestWithFile(makeFile('SO-123 North Wing.xlsx')),
			});

			expect(result).toEqual({
				status: 400,
				data: { error: 'Unknown tab type "Custom Tab" on row 42.' },
			});
		});

		it('inserts null for Unfaced tab values during final import', async () => {
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
				status: 'new',
				lines: [
					{
						sku_id: 7,
						thickness_in: 3,
						width_in: 48,
						qty: 4,
						length_ft: 100,
						sqft: 1600,
						rollfor: 'Wall',
						facing: 'Unfaced',
						instructions: 'Label A',
						tab_type: '1 X 6" TAB',
					},
				],
			};

			const result = await actions.import({
				request: requestWithForm([
					['accepted', 'SO-100'],
					['csv_data', JSON.stringify([acceptedWo])],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({ success: true, created: 1, updated: 0 });
			expect(conn.query).toHaveBeenNthCalledWith(
				3,
				'INSERT INTO work_order_lines (wo_id, sku_id, thickness_in, width_in, qty, length_ft, sqft, rollfor, facing, instructions, field_instructions, tab_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
				[101, 7, 3, 48, 4, 100, 1600, 'Wall', 'Unfaced', 'Label A', 'Label A', null]
			);
		});

		it('rejects tampered preview JSON with an invalid faced tab value before opening a transaction', async () => {
			const tamperedWo = {
				so_number: 'SO-100',
				customer_name: 'Acme',
				job_name: 'North Wing',
				branch: 'Tulsa',
				ship_date: '2026-05-15',
				status: 'new',
				lines: [
					{
						row: 17,
						sku_id: 7,
						thickness_in: 3,
						width_in: 48,
						qty: 4,
						length_ft: 100,
						sqft: 1600,
						rollfor: 'Wall',
						facing: 'FSK',
						instructions: 'Label A',
						tab_type: 'Custom Tab',
					},
				],
			};

			const result = await actions.import({
				request: requestWithForm([
					['accepted', 'SO-100'],
					['csv_data', JSON.stringify([tamperedWo])],
				]),
				locals: { appUser: { id: 9, role: 'admin' } },
			});

			expect(result).toEqual({
				status: 400,
				data: { error: 'Unknown tab type "Custom Tab" on row 17.' },
			});
			expect(db.getConnection).not.toHaveBeenCalled();
		});
	});
});
