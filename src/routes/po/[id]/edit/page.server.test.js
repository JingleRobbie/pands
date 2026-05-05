import { beforeEach, describe, expect, it, vi } from 'vitest';

const { conn, db } = vi.hoisted(() => {
	const conn = {
		beginTransaction: vi.fn(),
		commit: vi.fn(),
		query: vi.fn(),
		release: vi.fn(),
		rollback: vi.fn(),
	};

	return {
		conn,
		db: {
			getConnection: vi.fn(() => conn),
			query: vi.fn(),
		},
	};
});

vi.mock('$lib/db.js', () => ({ db }));

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

function validEntries(overrides = []) {
	return [
		['po_number', 'PO-1'],
		['vendor_name', 'Johns Manville'],
		['expected_date', '2026-05-01'],
		...overrides,
	];
}

describe('edit PO action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns not found when the PO does not exist', async () => {
		db.query.mockResolvedValueOnce([[]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(validEntries()),
		});

		expect(result).toEqual({ status: 404, data: { error: 'PO not found.' } });
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('rejects edits to non-open POs', async () => {
		db.query.mockResolvedValueOnce([[{ id: 12, status: 'RECEIVED' }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(validEntries()),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Only open POs can be edited.' },
		});
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('validates required fields before duplicate checks', async () => {
		db.query.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([['vendor_name', 'Johns Manville']]),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'PO number and expected date are required.' },
		});
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('rejects invalid vendors before duplicate checks', async () => {
		db.query.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([
				['po_number', 'PO-1'],
				['vendor_name', 'Bad Vendor'],
				['expected_date', '2026-05-01'],
			]),
		});

		expect(result).toEqual({ status: 400, data: { error: 'Invalid vendor.' } });
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('rejects duplicate PO numbers', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]])
			.mockResolvedValueOnce([[{ id: 44 }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(validEntries()),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: "PO number 'PO-1' already exists." },
		});
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('requires positive quantities for kept open lines', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([[{ id: 34 }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(
				validEntries([
					['line_id', '34'],
					['line_sqft', '0'],
				])
			),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'All kept line quantities must be at least 1.' },
		});
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('updates PO fields, deletes removed lines, updates kept lines, inserts new lines, and redirects', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([[{ id: 34 }, { id: 35 }]]);

		await expect(
			actions.default({
				params: { id: '12' },
				request: requestWithForm(
					validEntries([
						['return_to', '/po?status=open'],
						['line_id', '34'],
						['line_sqft', '500.4'],
						['sku_id', '2'],
						['sqft_ordered', '250.5'],
						['sku_id', ''],
						['sqft_ordered', '100'],
					])
				),
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/po/12?returnTo=%2Fpo%3Fstatus%3Dopen',
		});

		expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
		expect(conn.query).toHaveBeenNthCalledWith(
			1,
			'UPDATE purchase_orders SET po_number = ?, vendor_name = ?, expected_date = ? WHERE id = ?',
			['PO-1', 'Johns Manville', '2026-05-01', '12']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			2,
			'DELETE FROM purchase_order_lines WHERE id = ?',
			[35]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			3,
			'UPDATE purchase_order_lines SET sqft_ordered = ? WHERE id = ?',
			[500, 34]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			4,
			'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
			['12', '2', 251]
		);
		expect(conn.commit).toHaveBeenCalledTimes(1);
		expect(conn.rollback).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledTimes(1);
	});

	it('rolls back and returns the service error when persistence fails', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([[]]);
		conn.query.mockRejectedValueOnce(new Error('database unavailable'));

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(validEntries()),
		});

		expect(result).toEqual({ status: 500, data: { error: 'database unavailable' } });
		expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
		expect(conn.rollback).toHaveBeenCalledTimes(1);
		expect(conn.commit).not.toHaveBeenCalled();
		expect(conn.release).toHaveBeenCalledTimes(1);
	});
});
