import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllShipments } = vi.hoisted(() => ({
	getAllShipments: vi.fn(),
}));

vi.mock('$lib/services/shipping.js', () => ({
	getAllShipments,
}));

const { load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/shipments${search}`);
}

describe('shipments load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-05T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('defaults to draft shipments without a from date', async () => {
		const shipments = [{ id: 1, status: 'DRAFT' }];
		getAllShipments.mockResolvedValueOnce(shipments);

		const result = await load({ url: urlWithSearch() });

		expect(getAllShipments).toHaveBeenCalledWith({ status: 'draft', from: '' });
		expect(result).toEqual({ shipments, status: 'draft', from: '' });
	});

	it('uses the requested from date for shipped shipments', async () => {
		const shipments = [{ id: 2, status: 'SHIPPED' }];
		getAllShipments.mockResolvedValueOnce(shipments);

		const result = await load({ url: urlWithSearch('?status=shipped&from=2026-04-01') });

		expect(getAllShipments).toHaveBeenCalledWith({ status: 'shipped', from: '2026-04-01' });
		expect(result).toEqual({ shipments, status: 'shipped', from: '2026-04-01' });
	});

	it('defaults shipped/all filters to 90 days back when from is invalid', async () => {
		const shipments = [];
		getAllShipments.mockResolvedValueOnce(shipments);

		const result = await load({ url: urlWithSearch('?status=all&from=not-a-date') });

		expect(getAllShipments).toHaveBeenCalledWith({ status: 'all', from: '2026-02-04' });
		expect(result).toEqual({ shipments, status: 'all', from: '2026-02-04' });
	});

	it('falls back to draft for unknown statuses', async () => {
		const shipments = [];
		getAllShipments.mockResolvedValueOnce(shipments);

		const result = await load({ url: urlWithSearch('?status=cancelled&from=2026-04-01') });

		expect(getAllShipments).toHaveBeenCalledWith({ status: 'draft', from: '' });
		expect(result).toEqual({ shipments, status: 'draft', from: '' });
	});
});
