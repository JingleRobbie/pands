import { describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { load } = await import('./+page.server.js');

describe('production schedule load', () => {
	it('redirects to the production list', () => {
		try {
			load();
			throw new Error('Expected redirect');
		} catch (err) {
			expect(err).toEqual({ type: 'redirect', status: 302, location: '/production' });
		}
	});
});
