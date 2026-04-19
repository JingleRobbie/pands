export async function load({ locals }) {
	return { user: locals.appUser ?? null };
}
