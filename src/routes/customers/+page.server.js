import { getAllCustomers } from '$lib/services/customers.js';

export async function load() {
	const customers = await getAllCustomers();
	return { customers };
}
