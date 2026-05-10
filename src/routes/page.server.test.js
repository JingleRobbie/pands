import { describe, expect, it } from 'vitest';

const { load } = await import('./+page.server.js');

describe('root page', () => {
	it('returns the current app user for the activity landing page', async () => {
		const appUser = { id: 7, display_name: 'Admin' };

		expect(load({ locals: { appUser } })).toEqual({ appUser });
	});
});
