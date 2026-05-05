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
		['so_number', 'SO-1'],
		['customer_name', 'Acme'],
		['job_name', 'North Wing'],
		['ship_date', '2026-05-01'],
		...overrides,
	];
}

describe('edit SO action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns not found when the SO does not exist', async () => {
		db.query.mockResolvedValueOnce([[]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(validEntries()),
		});

		expect(result).toEqual({ status: 404, data: { error: 'SO not found.' } });
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('rejects edits to completed SOs', async () => {
		db.query.mockResolvedValueOnce([[{ id: 12, status: 'COMPLETED' }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(validEntries()),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Only open or in-progress SOs can be edited.' },
		});
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('validates required fields before duplicate checks', async () => {
		db.query.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([['customer_name', 'Acme']]),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'SO number, customer, job name, and ship date are required.' },
		});
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('rejects duplicate SO numbers', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]])
			.mockResolvedValueOnce([[{ id: 44 }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(validEntries()),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: "SO number 'SO-1' already exists." },
		});
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('requires positive quantities for kept editable lines', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'OPEN' }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([[{ id: 34, sqft_produced: 0 }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(
				validEntries([
					['line_id', '34'],
					['line_sqft', '0'],
					['line_facing', 'Faced'],
				])
			),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'All line quantities must be at least 1.' },
		});
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('prevents reducing an editable line below already produced sqft', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'IN_PROGRESS' }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([[{ id: 34, sqft_produced: 300 }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm(
				validEntries([
					['line_id', '34'],
					['line_sqft', '250'],
					['line_facing', 'Faced'],
				])
			),
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'Sq ft cannot be less than what has already been produced.' },
		});
		expect(db.getConnection).not.toHaveBeenCalled();
	});

	it('updates SO fields, deletes removed editable lines, updates kept lines, inserts new lines, and redirects', async () => {
		db.query
			.mockResolvedValueOnce([[{ id: 12, status: 'IN_PROGRESS' }]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([
				[
					{ id: 34, sqft_produced: 100 },
					{ id: 35, sqft_produced: 0 },
				],
			]);

		await expect(
			actions.default({
				params: { id: '12' },
				request: requestWithForm(
					validEntries([
						['return_to', '/so?status=open'],
						['line_id', '34'],
						['line_sqft', '500.4'],
						['line_facing', 'Unfaced'],
						['sku_id', '2'],
						['sqft_ordered', '250.5'],
						['new_facing', ''],
						['sku_id', ''],
						['sqft_ordered', '100'],
						['new_facing', 'Faced'],
					])
				),
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/so/12?returnTo=%2Fso%3Fstatus%3Dopen',
		});

		expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
		expect(conn.query).toHaveBeenNthCalledWith(
			1,
			'UPDATE sales_orders SET so_number = ?, customer_name = ?, job_name = ?, ship_date = ? WHERE id = ?',
			['SO-1', 'Acme', 'North Wing', '2026-05-01', '12']
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			2,
			'DELETE FROM sales_order_lines WHERE id = ?',
			[35]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			3,
			'UPDATE sales_order_lines SET sqft_ordered = ?, facing = ? WHERE id = ?',
			[500, 'Unfaced', 34]
		);
		expect(conn.query).toHaveBeenNthCalledWith(
			4,
			'INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, facing) VALUES (?, ?, ?, ?)',
			['12', '2', 251, 'Faced']
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
