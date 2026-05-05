import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
}));

vi.mock('$lib/db.js', () => ({ db }));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
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

describe('work order address page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws not found when the work order is missing', async () => {
		db.query.mockResolvedValueOnce([[]]);

		await expect(load({ params: { id: '42' } })).rejects.toEqual({
			type: 'error',
			status: 404,
			message: 'Work order not found',
		});
	});

	it('loads the work order without saved addresses when it has no customer', async () => {
		const wo = { id: 42, so_number: 'SO-1', customer_id: null };
		db.query.mockResolvedValueOnce([[wo]]);

		const result = await load({ params: { id: '42' } });

		expect(result).toEqual({ wo, savedAddresses: [] });
		expect(db.query).toHaveBeenCalledTimes(1);
	});

	it('loads saved addresses for the work order customer', async () => {
		const wo = { id: 42, so_number: 'SO-1', customer_id: 12 };
		const savedAddresses = [{ id: 3, nickname: 'Main Dock' }];
		db.query.mockResolvedValueOnce([[wo]]).mockResolvedValueOnce([savedAddresses]);

		const result = await load({ params: { id: '42' } });

		expect(result).toEqual({ wo, savedAddresses });
		expect(db.query).toHaveBeenNthCalledWith(
			2,
			'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY nickname',
			[12]
		);
	});

	it('updates the work order address and redirects back to the work order', async () => {
		db.query.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				params: { id: '42' },
				request: requestWithForm([
					['ship_to_name', ' Acme Dock '],
					['ship_addr1', ' 1 Main St '],
					['ship_addr2', ' '],
					['ship_city', ' Omaha '],
					['ship_state', ' NE '],
					['ship_zip', ' 68102 '],
				]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/wo/42' });

		expect(db.query).toHaveBeenCalledWith(
			`UPDATE work_orders
			 SET ship_to_name=?, ship_addr1=?, ship_addr2=?, ship_city=?, ship_state=?, ship_zip=?
			 WHERE id=?`,
			['Acme Dock', '1 Main St', null, 'Omaha', 'NE', '68102', '42']
		);
		expect(db.query).toHaveBeenCalledTimes(1);
	});

	it('saves a named address to the customer address book when requested', async () => {
		db.query
			.mockResolvedValueOnce([{}])
			.mockResolvedValueOnce([[{ customer_id: 12 }]])
			.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				params: { id: '42' },
				request: requestWithForm([
					['ship_to_name', 'Acme Dock'],
					['ship_addr1', '1 Main St'],
					['ship_city', 'Omaha'],
					['ship_state', 'NE'],
					['ship_zip', '68102'],
					['save_to_book', 'on'],
					['nickname', 'Main Dock'],
				]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/wo/42' });

		expect(db.query).toHaveBeenNthCalledWith(2, 'SELECT customer_id FROM work_orders WHERE id = ?', [
			'42',
		]);
		expect(db.query).toHaveBeenNthCalledWith(
			3,
			`INSERT INTO customer_addresses (customer_id, nickname, ship_to_name, addr1, addr2, city, state, zip)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[12, 'Main Dock', 'Acme Dock', '1 Main St', null, 'Omaha', 'NE', '68102']
		);
	});

	it('does not save to the address book without a nickname', async () => {
		db.query.mockResolvedValueOnce([{}]);

		await expect(
			actions.default({
				params: { id: '42' },
				request: requestWithForm([
					['ship_to_name', 'Acme Dock'],
					['save_to_book', 'on'],
				]),
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/wo/42' });

		expect(db.query).toHaveBeenCalledTimes(1);
	});
});
