import { describe, expect, it } from 'vitest';

const { load } = await import('./+page.server.js');

describe('calendar load', () => {
	it('returns the current user when present', async () => {
		const user = { id: 9, name: 'Alex' };

		const result = await load({ locals: { appUser: user } });

		expect(result).toEqual({ user });
	});

	it('returns null user when no app user is present', async () => {
		const result = await load({ locals: {} });

		expect(result).toEqual({ user: null });
	});
});
