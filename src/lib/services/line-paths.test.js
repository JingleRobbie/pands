import { describe, expect, it } from 'vitest';
import {
	canLineBlockWoCompletion,
	deriveLineType,
	hasRawFacing,
	inferPathType,
	isLineProductionComplete,
} from './line-paths.js';

describe('line path helpers', () => {
	it('derives line type from parent and child relationships', () => {
		expect(deriveLineType({ parent_line_id: null, child_count: 0 })).toBe('UNBRANCHED');
		expect(deriveLineType({ parent_line_id: null, child_count: 2 })).toBe('BILLING');
		expect(deriveLineType({ parent_line_id: 10, child_count: 0 })).toBe('PRODUCTION');
	});

	it('normalizes raw and unfaced facing values', () => {
		expect(hasRawFacing({ facing: 'Raw' })).toBe(true);
		expect(hasRawFacing({ facing: ' unfaced ' })).toBe(true);
		expect(hasRawFacing({ facing: 'FSK' })).toBe(false);
	});

	it('infers only shippable fulfillment paths', () => {
		expect(inferPathType({ parent_line_id: null, child_count: 0, facing: 'FSK' })).toBe(
			'STANDARD'
		);
		expect(inferPathType({ parent_line_id: null, child_count: 0, facing: 'Raw' })).toBe(
			'DIRECT_SHIP'
		);
		expect(inferPathType({ parent_line_id: 10, facing: 'ASJ' })).toBe('CUT_LAMINATE');
		expect(inferPathType({ parent_line_id: 10, facing: 'Unfaced' })).toBe('CUT_SHIP');
		expect(inferPathType({ parent_line_id: null, child_count: 2, facing: 'FSK' })).toBeNull();
	});

	it('keeps billing parents from blocking production completion', () => {
		expect(
			isLineProductionComplete({
				parent_line_id: null,
				child_count: 2,
				rolls_produced: 0,
				qty: 10,
			})
		).toBe(true);
		expect(
			isLineProductionComplete({
				parent_line_id: null,
				child_count: 0,
				rolls_produced: 9,
				qty: 10,
			})
		).toBe(false);
	});

	it('only stale billing-like lines block work order completion', () => {
		expect(
			canLineBlockWoCompletion({
				parent_line_id: null,
				child_count: 0,
				reconciliation_status: 'STALE',
			})
		).toBe(true);
		expect(
			canLineBlockWoCompletion({
				parent_line_id: 10,
				reconciliation_status: 'STALE',
			})
		).toBe(false);
	});
});
