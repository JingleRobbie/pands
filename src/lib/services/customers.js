import { db } from '$lib/db.js';

export async function getAllCustomers() {
	const [rows] = await db.query('SELECT * FROM customers ORDER BY name');
	return rows;
}

export async function getCustomer(id) {
	const [[row]] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
	return row;
}

export async function createCustomer(fields) {
	const [result] = await db.query('INSERT INTO customers (name, phone) VALUES (?, ?)', [
		fields.name,
		fields.phone || null,
	]);
	return result.insertId;
}

export async function updateCustomer(id, fields) {
	await db.query('UPDATE customers SET name = ?, phone = ? WHERE id = ?', [
		fields.name,
		fields.phone || null,
		id,
	]);
}

export async function findCustomerByName(name) {
	const [[row]] = await db.query('SELECT id FROM customers WHERE LOWER(name) = LOWER(?)', [name]);
	return row || null;
}
