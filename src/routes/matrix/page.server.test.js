import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMatrixData } = vi.hoisted(() => ({
	getMatrixData: vi.fn(),
}));

vi.mock('$lib/services/inventory.js', () => ({
	getMatrixData,
}));

const { load } = await import('./+page.server.js');

describe('matrix load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads matrix data from the inventory service', async () => {
		const matrix = {
			skus: [{ id: 1, display_label: '3 x 48' }],
			balanceRow: { cells: {} },
			rows: [],
		};
		getMatrixData.mockResolvedValueOnce(matrix);

		const result = await load();

		expect(getMatrixData).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ matrix });
	});
});
