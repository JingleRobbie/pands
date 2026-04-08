import { describe, it, expect } from 'vitest';
import { fmtDate, fmtSqft } from './utils.js';

describe('fmtDate', () => {
	it('formats an ISO date string', () => {
		expect(fmtDate('2026-04-07')).toBe('Apr 7, 2026');
	});

	it('returns em dash for null', () => {
		expect(fmtDate(null)).toBe('—');
	});

	it('returns em dash for empty string', () => {
		expect(fmtDate('')).toBe('—');
	});

	it('returns em dash for undefined', () => {
		expect(fmtDate(undefined)).toBe('—');
	});
});

describe('fmtSqft', () => {
	it('formats a number with thousands separator', () => {
		expect(fmtSqft(12345)).toBe('12,345');
	});

	it('formats small numbers without separator', () => {
		expect(fmtSqft(500)).toBe('500');
	});

	it('returns em dash for null', () => {
		expect(fmtSqft(null)).toBe('—');
	});

	it('returns em dash for undefined', () => {
		expect(fmtSqft(undefined)).toBe('—');
	});

	it('handles zero', () => {
		expect(fmtSqft(0)).toBe('0');
	});
});
