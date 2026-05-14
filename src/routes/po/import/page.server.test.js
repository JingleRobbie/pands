import { beforeEach, describe, expect, it, vi } from 'vitest';
import xlsx from 'xlsx';

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

vi.mock('@sveltejs/kit', () => ({
	fail: vi.fn((status, data) => ({ status, data })),
}));

const { actions, load, __poImportTest } = await import('./+page.server.js');

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

function workbookFile(sheets) {
	const workbook = xlsx.utils.book_new();
	for (const [name, rows] of Object.entries(sheets)) {
		xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(rows), name);
	}
	const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsm' });
	return new Blob([buffer], {
		type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
	});
}

describe('purchase order import page', () => {
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

	it('parses the grouped source sheet without a flattened Formatted tab', async () => {
		db.query
			.mockResolvedValueOnce([
				[
					{ id: 7, sku_code: '3036' },
					{ id: 8, sku_code: '3048' },
				],
			])
			.mockResolvedValueOnce([[]]);

		const file = workbookFile({
			Sheet1: [
				[
					'',
					'',
					'',
					'',
					'',
					'Date',
					'Num',
					'Name',
					'Source Name',
					'Memo',
					'Deliv Date',
					'Qty',
				],
				['', '', 'INSULATION - BLANKET (DO NOT USE - ITEM CATEGORY)'],
				['', '', '', '3036 (Blanket Insulation 3" X 36")'],
				[
					'',
					'',
					'',
					'',
					'',
					'04/15/2026',
					'59179',
					"JOHNS MANVILLE INT'L, INC",
					"JOHNS MANVILLE INT'L, INC",
					'Blanket Insulation 3" X 36"',
					'05/14/2026',
					'12,000.00 ',
				],
				[
					'',
					'',
					'',
					'Total 3036 (Blanket Insulation 3" X 36")',
					'',
					'',
					'',
					'',
					'',
					'',
					'',
					'12,000.00 ',
				],
				['', '', '', '3048 (Blanket Insulation 3" X 48")'],
				[
					'',
					'',
					'',
					'',
					'',
					'04/15/2026',
					'59179',
					"JOHNS MANVILLE INT'L, INC",
					"JOHNS MANVILLE INT'L, INC",
					'Blanket Insulation 3" X 48"',
					'05/14/2026',
					'16,000.00 ',
				],
			],
		});

		const result = await actions.parse({
			request: requestWithForm([['xlsm', file]]),
		});

		expect(result.preview).toEqual([
			{
				po_number: '59179',
				vendor_name: 'Johns Manville',
				expected_date: '2026-05-14',
				status: 'new',
				lines: [
					{ sku_id: 7, sku_code: '3036', sqft_ordered: 12000 },
					{ sku_id: 8, sku_code: '3048', sqft_ordered: 16000 },
				],
			},
		]);
		expect(db.query).toHaveBeenNthCalledWith(1, 'SELECT id, sku_code FROM material_skus');
	});

	it('parses decimal-formatted square footage without shifting by cents', () => {
		expect(__poImportTest.parseSqft('12,000.00 ')).toBe(12000);
		expect(__poImportTest.parseSqft('$2,766.00')).toBe(2766);
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

	it('imports accepted new POs and skips unaccepted preview rows', async () => {
		conn.query.mockResolvedValueOnce([{ insertId: 101 }]).mockResolvedValue([{}]);
		const acceptedPo = {
			po_number: 'PO-100',
			vendor_name: 'Johns Manville',
			expected_date: '2026-05-15',
			status: 'new',
			lines: [
				{ sku_id: 7, sqft_ordered: 1200 },
				{ sku_id: 8, sqft_ordered: 800 },
			],
		};
		const skippedPo = {
			po_number: 'PO-200',
			vendor_name: 'Certainteed',
			expected_date: '2026-05-20',
			status: 'new',
			lines: [{ sku_id: 9, sqft_ordered: 400 }],
		};

		const result = await actions.import({
			request: requestWithForm([
				['accepted', 'PO-100'],
				['csv_data', JSON.stringify([acceptedPo, skippedPo])],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ success: true, created: 1, updated: 0, cancelled: 0 });
		expect(db.getConnection).toHaveBeenCalledOnce();
		expect(conn.beginTransaction).toHaveBeenCalledOnce();
		expect(conn.query).toHaveBeenNthCalledWith(
			1,
			'INSERT INTO purchase_orders (po_number, vendor_name, expected_date) VALUES (?, ?, ?)',
			['PO-100', 'Johns Manville', '2026-05-15']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			2,
			'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
			[101, 7, 1200]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			3,
			'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
			[101, 8, 800]
		);
		expect(conn.query).toHaveBeenCalledTimes(3);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});

	it('rolls back, releases the connection, and returns an error when import fails', async () => {
		conn.query.mockRejectedValueOnce(new Error('database unavailable'));

		const result = await actions.import({
			request: requestWithForm([
				['accepted', 'PO-100'],
				[
					'csv_data',
					JSON.stringify([
						{
							po_number: 'PO-100',
							vendor_name: 'Johns Manville',
							expected_date: '2026-05-15',
							status: 'new',
							lines: [{ sku_id: 7, sqft_ordered: 1200 }],
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

	it('updates accepted changed POs and cancels accepted removed POs', async () => {
		conn.query.mockResolvedValue([{}]);
		const changedPo = {
			po_number: 'PO-100',
			vendor_name: 'Certainteed',
			expected_date: '2026-05-20',
			status: 'changed',
			existing_id: 101,
			lines: [{ sku_id: 7, sqft_ordered: 1400 }],
		};
		const removedPo = {
			po_number: 'PO-200',
			status: 'removed',
			existing_id: 202,
			lines: [],
		};

		const result = await actions.import({
			request: requestWithForm([
				['accepted', 'PO-100'],
				['accepted', 'PO-200'],
				['csv_data', JSON.stringify([changedPo, removedPo])],
			]),
			locals: { appUser: { id: 9, role: 'admin' } },
		});

		expect(result).toEqual({ success: true, created: 0, updated: 1, cancelled: 1 });
		expect(conn.beginTransaction).toHaveBeenCalledOnce();
		expect(conn.query).toHaveBeenNthCalledWith(
			1,
			'UPDATE purchase_orders SET vendor_name = ?, expected_date = ? WHERE id = ?',
			['Certainteed', '2026-05-20', 101]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			2,
			"DELETE FROM purchase_order_lines WHERE po_id = ? AND status = 'OPEN'",
			[101]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			3,
			'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
			[101, 7, 1400]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			4,
			"UPDATE purchase_orders SET status = 'CANCELLED' WHERE id = ?",
			[202]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			5,
			"UPDATE purchase_order_lines SET status = 'CANCELLED' WHERE po_id = ? AND status = 'OPEN'",
			[202]
		);
		expect(conn.commit).toHaveBeenCalledOnce();
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledOnce();
	});
});
