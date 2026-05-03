import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db.js', () => ({ db: {} }));

const { __productionTest } = await import('./production.js');

describe('production helpers', () => {
	it('calculates square feet from rolls, width, and length', () => {
		expect(__productionTest.calcSqft({ width_in: 48, length_ft: 100 }, 3)).toBe(1200);
	});

	it('normalizes date-like values to yyyy-mm-dd', () => {
		expect(__productionTest.dateOnly('2026-04-07T10:30:00.000Z')).toBe('2026-04-07');
		expect(__productionTest.dateOnly(new Date('2026-04-07T12:00:00.000Z'))).toBe('2026-04-07');
		expect(__productionTest.dateOnly(null)).toBeNull();
	});

	it('validates scheduled rolls against remaining rolls', () => {
		expect(() => __productionTest.validateRollsScheduled(0, 3)).toThrow(
			'Rolls scheduled must be greater than zero.'
		);
		expect(() => __productionTest.validateRollsScheduled(4, 3, 'line 10')).toThrow(
			'Cannot schedule 4 rolls for line 10 - only 3 remaining.'
		);
	});

	it('rejects missing, completed, and over-produced runs', () => {
		expect(() => __productionTest.validateConfirmableRun(null, 1)).toThrow(
			'Production run not found.'
		);
		expect(() =>
			__productionTest.validateConfirmableRun({ status: 'COMPLETED', rolls_scheduled: 2 }, 1)
		).toThrow('This run is already completed.');
		expect(() =>
			__productionTest.validateConfirmableRun({ status: 'SCHEDULED', rolls_scheduled: 2 }, 3)
		).toThrow('Cannot record 3 rolls - only 2 rolls were scheduled.');
	});

	it('validates unproduce rolls against unshipped rolls', () => {
		expect(() => __productionTest.validateUnproduceRolls(0, 3)).toThrow(
			'Rolls to unproduce must be greater than zero.'
		);
		expect(() => __productionTest.validateUnproduceRolls(4, 3)).toThrow(
			'Cannot unproduce 4 rolls - only 3 rolls are unshipped.'
		);
		expect(() => __productionTest.validateUnproduceRolls(3, 3)).not.toThrow();
	});

	it('uses exact actual square feet when fully unproducing a run', () => {
		const line = { width_in: 48, length_ft: 100 };
		const run = { rolls_actual: 3, sqft_actual: 1199 };

		expect(__productionTest.prorateUnproduceSqft(line, run, 3)).toBe(1199);
		expect(__productionTest.prorateUnproduceSqft(line, run, 2)).toBe(800);
	});
});
