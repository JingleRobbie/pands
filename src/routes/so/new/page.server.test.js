import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('@sveltejs/kit', () => ({
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

describe('new SO action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('requires SO number, customer, job name, and ship date before querying duplicates', async () => {
		const result = await actions.default({
			request: requestWithForm([
				['so_number', 'SO-1'],
				['customer_name', 'Acme'],
				['job_name', ''],
				['ship_date', '2026-05-01'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'SO number, customer, job name, and ship date are required.' },
		});
		expect(db.query).not.toHaveBeenCalled();
	});

	it('rejects duplicate SO numbers', async () => {
		db.query.mockResolvedValueOnce([[{ id: 12 }]]);

		const result = await actions.default({
			request: requestWithForm([
				['so_number', 'SO-1'],
				['customer_name', 'Acme'],
				['job_name', 'North Wing'],
				['ship_date', '2026-05-01'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: "SO number 'SO-1' already exists." },
		});
	});

	it('requires at least one positive line item', async () => {
		db.query.mockResolvedValueOnce([[]]);

		const result = await actions.default({
			request: requestWithForm([
				['so_number', 'SO-1'],
				['customer_name', 'Acme'],
				['job_name', 'North Wing'],
				['ship_date', '2026-05-01'],
				['sku_id', '1'],
				['sqft_ordered', '0'],
				['facing', 'Unfaced'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Add at least one line item.' } });
	});

	it('creates the SO and positive line items, then redirects to detail', async () => {
		db.query
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([{ insertId: 12 }])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				request: requestWithForm([
					['so_number', 'SO-1'],
					['customer_name', 'Acme'],
					['job_name', 'North Wing'],
					['ship_date', '2026-05-01'],
					['sku_id', '1'],
					['sqft_ordered', '500.4'],
					['facing', 'Unfaced'],
					['sku_id', '2'],
					['sqft_ordered', '250.5'],
					['facing', ''],
					['sku_id', ''],
					['sqft_ordered', '100'],
					['facing', 'Faced'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/so/12' });

		expect(db.query).toHaveBeenNthCalledWith(
			2,
			'INSERT INTO sales_orders (so_number, customer_name, job_name, ship_date, created_by) VALUES (?, ?, ?, ?, ?)',
			['SO-1', 'Acme', 'North Wing', '2026-05-01', 9]
		);
		expect(db.query).toHaveBeenNthCalledWith(
			3,
			'INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, facing) VALUES (?, ?, ?, ?)',
			[12, '1', 500, 'Unfaced']
		);
		expect(db.query).toHaveBeenNthCalledWith(
			4,
			'INSERT INTO sales_order_lines (so_id, sku_id, sqft_ordered, facing) VALUES (?, ?, ?, ?)',
			[12, '2', 251, 'Faced']
		);
	});
});
