import { getMatrixData } from '$lib/services/inventory.js';

export async function load() {
	const matrix = await getMatrixData();
	return { matrix };
}
