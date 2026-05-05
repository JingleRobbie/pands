import { describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { GET } = await import('./+server.js');

describe('logout endpoint', () => {
	it('deletes the app user cookie and redirects to the calendar', () => {
		const cookies = { delete: vi.fn() };

		expect(() => GET({ cookies })).toThrow({
			type: 'redirect',
			status: 302,
			location: '/calendar',
		});

		expect(cookies.delete).toHaveBeenCalledWith('app_user_id', { path: '/' });
	});
});
