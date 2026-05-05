import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, receivePoLines } = vi.hoisted(() => ({
	db: {
		query: vi.fn(),
	},
	receivePoLines: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/services/purchasing.js', () => ({ receivePoLines }));

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

describe('receiving action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns not found when the PO does not exist', async () => {
		db.query.mockResolvedValueOnce([[]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([['return_to', '/receiving']]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ status: 404, data: { error: 'PO not found.' } });
		expect(receivePoLines).not.toHaveBeenCalled();
	});

	it('rejects receiving a PO that is not open', async () => {
		db.query.mockResolvedValueOnce([[{ status: 'RECEIVED' }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([['return_to', '/receiving']]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'This PO is not open for receiving.' },
		});
		expect(receivePoLines).not.toHaveBeenCalled();
	});

	it('rejects invalid received quantities before calling the service', async () => {
		db.query.mockResolvedValueOnce([[{ status: 'OPEN' }]]);

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([
				['return_to', '/receiving'],
				['line_id', '34'],
				['sqft_received', '0'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'All received quantities must be at least 1.' },
		});
		expect(receivePoLines).not.toHaveBeenCalled();
	});

	it('receives selected lines and redirects to a safe return path', async () => {
		db.query.mockResolvedValueOnce([[{ status: 'OPEN' }]]);
		receivePoLines.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '12' },
				request: requestWithForm([
					['return_to', '/receiving?from=2026-05-01'],
					['line_id', '34'],
					['sqft_received', '500.4'],
					['line_id', '35'],
					['sqft_received', '250.5'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/receiving?from=2026-05-01',
		});

		expect(receivePoLines).toHaveBeenCalledWith(
			12,
			[
				{ lineId: 34, sqftReceived: 500 },
				{ lineId: 35, sqftReceived: 251 },
			],
			9
		);
	});

	it('returns a user-facing failure when the service rejects receipt', async () => {
		db.query.mockResolvedValueOnce([[{ status: 'OPEN' }]]);
		receivePoLines.mockRejectedValueOnce(new Error('Line 34 is not an open line on PO 12'));

		const result = await actions.default({
			params: { id: '12' },
			request: requestWithForm([
				['return_to', '/receiving'],
				['line_id', '34'],
				['sqft_received', '500'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 500,
			data: { error: 'Line 34 is not an open line on PO 12' },
		});
	});
});
