import { describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { load } = await import('./+page.server.js');

describe('root page', () => {
	it('redirects to the calendar', async () => {
		await expect(load()).rejects.toEqual({
			type: 'redirect',
			status: 302,
			location: '/calendar',
		});
	});
});
