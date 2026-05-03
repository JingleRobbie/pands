import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db.js', () => ({ db: {} }));

const { __shippingTest } = await import('./shipping.js');

describe('shipping helpers', () => {
	it('prorates partial run sqft and preserves full-run totals', () => {
		expect(__shippingTest.prorateSqft(2, 5, 101)).toBe(40);
		expect(__shippingTest.prorateSqft(5, 5, 101)).toBe(101);
	});

	it('rejects invalid roll counts', () => {
		expect(() => __shippingTest.validateRollsToShip(0, 3)).toThrow(
			'Rolls to ship must be greater than zero.'
		);
		expect(() => __shippingTest.validateRollsToShip(4, 3)).toThrow(
			'Cannot ship 4 rolls - only 3 rolls are available.'
		);
	});
});
