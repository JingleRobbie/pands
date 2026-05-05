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

describe('new PO action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('requires PO number and expected date before querying for duplicates', async () => {
		const result = await actions.default({
			request: requestWithForm([['vendor_name', 'Johns Manville']]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'PO number and expected date are required.' },
		});
		expect(db.query).not.toHaveBeenCalled();
	});

	it('rejects invalid vendors before querying for duplicates', async () => {
		const result = await actions.default({
			request: requestWithForm([
				['po_number', 'PO-1'],
				['vendor_name', 'Bad Vendor'],
				['expected_date', '2026-05-01'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Invalid vendor.' } });
		expect(db.query).not.toHaveBeenCalled();
	});

	it('rejects duplicate PO numbers', async () => {
		db.query.mockResolvedValueOnce([[{ id: 12 }]]);

		const result = await actions.default({
			request: requestWithForm([
				['po_number', 'PO-1'],
				['vendor_name', 'Johns Manville'],
				['expected_date', '2026-05-01'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: "PO number 'PO-1' already exists." },
		});
	});

	it('requires at least one positive line item', async () => {
		db.query.mockResolvedValueOnce([[]]);

		const result = await actions.default({
			request: requestWithForm([
				['po_number', 'PO-1'],
				['vendor_name', 'Johns Manville'],
				['expected_date', '2026-05-01'],
				['sku_id', '1'],
				['sqft_ordered', '0'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 400, data: { error: 'Add at least one line item.' } });
	});

	it('creates the PO and positive line items, then redirects to detail', async () => {
		db.query
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([{ insertId: 12 }])
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				request: requestWithForm([
					['po_number', 'PO-1'],
					['vendor_name', 'Johns Manville'],
					['expected_date', '2026-05-01'],
					['sku_id', '1'],
					['sqft_ordered', '500.4'],
					['sku_id', '2'],
					['sqft_ordered', '250.5'],
					['sku_id', ''],
					['sqft_ordered', '100'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/po/12' });

		expect(db.query).toHaveBeenNthCalledWith(
			2,
			'INSERT INTO purchase_orders (po_number, vendor_name, expected_date, created_by) VALUES (?, ?, ?, ?)',
			['PO-1', 'Johns Manville', '2026-05-01', 9]
		);
		expect(db.query).toHaveBeenNthCalledWith(
			3,
			'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
			[12, '1', 500]
		);
		expect(db.query).toHaveBeenNthCalledWith(
			4,
			'INSERT INTO purchase_order_lines (po_id, sku_id, sqft_ordered) VALUES (?, ?, ?)',
			[12, '2', 251]
		);
	});
});
