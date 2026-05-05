import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmShipment } = vi.hoisted(() => ({
	confirmShipment: vi.fn(),
}));

vi.mock('$lib/services/shipping.js', () => ({
	confirmShipment,
	getShipment: vi.fn(),
}));

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

describe('shipment confirm action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects invalid line roll counts before calling the service', async () => {
		const result = await actions.default({
			params: { id: '123' },
			request: requestWithForm([
				['return_to', '/shipments?status=draft'],
				['line_rolls_15', '0'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'All roll counts must be at least 1.' },
		});
		expect(confirmShipment).not.toHaveBeenCalled();
	});

	it('rejects forms without line rolls before calling the service', async () => {
		const result = await actions.default({
			params: { id: '123' },
			request: requestWithForm([['return_to', '/shipments?status=draft']]),
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { error: 'No roll lines found.' },
		});
		expect(confirmShipment).not.toHaveBeenCalled();
	});

	it('returns a user-facing failure when the service rejects the shipment', async () => {
		confirmShipment.mockRejectedValueOnce(
			new Error('Cannot ship 6 rolls - only 5 rolls are available.')
		);

		const result = await actions.default({
			params: { id: '123' },
			request: requestWithForm([
				['return_to', '/shipments?status=draft'],
				['line_rolls_15', '6'],
			]),
			locals: { appUser: { id: 9 } },
		});

		expect(confirmShipment).toHaveBeenCalledWith(123, { 15: 6 }, 9);
		expect(result).toEqual({
			status: 500,
			data: { error: 'Cannot ship 6 rolls - only 5 rolls are available.' },
		});
	});

	it('confirms the shipment and redirects back to the shipment detail', async () => {
		confirmShipment.mockResolvedValueOnce();

		await expect(
			actions.default({
				params: { id: '123' },
				request: requestWithForm([
					['return_to', '/shipments?status=draft'],
					['line_rolls_15', '2'],
				]),
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({
			type: 'redirect',
			status: 303,
			location: '/shipments/123?shipped=1&returnTo=%2Fshipments%3Fstatus%3Ddraft',
		});

		expect(confirmShipment).toHaveBeenCalledWith(123, { 15: 2 }, 9);
	});
});
