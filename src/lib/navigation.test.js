import { describe, expect, it } from 'vitest';
import { getReturnTo, pathWithSearch, safeReturnTo, withReturnTo } from './navigation.js';

describe('navigation helpers', () => {
	it('builds a pathname and query string from a URL', () => {
		expect(pathWithSearch(new URL('http://pands.local/production?status=completed'))).toBe(
			'/production?status=completed'
		);
	});

	it('preserves only same-app return paths', () => {
		expect(safeReturnTo('/po?status=open', '/po')).toBe('/po?status=open');
		expect(safeReturnTo('https://example.com', '/po')).toBe('/po');
		expect(safeReturnTo('//example.com', '/po')).toBe('/po');
		expect(safeReturnTo('/po\\evil', '/po')).toBe('/po');
	});

	it('reads returnTo from a URL with fallback', () => {
		const url = new URL('http://pands.local/po/1?returnTo=%2Fpo%3Fstatus%3Dopen');
		expect(getReturnTo(url, '/po')).toBe('/po?status=open');
		expect(getReturnTo(new URL('http://pands.local/po/1'), '/po')).toBe('/po');
	});

	it('adds encoded returnTo to links', () => {
		expect(withReturnTo('/po/1', '/po?status=open')).toBe(
			'/po/1?returnTo=%2Fpo%3Fstatus%3Dopen'
		);
		expect(withReturnTo('/po/1?foo=bar', '/po?status=open')).toBe(
			'/po/1?foo=bar&returnTo=%2Fpo%3Fstatus%3Dopen'
		);
	});
});
