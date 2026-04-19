import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = parse(readFileSync(resolve(__dirname, '../.env'), 'utf8'));

const [, , displayName, password] = process.argv;
if (!displayName || !password) {
	console.error('Usage: node scripts/set-password.js "Display Name" "password"');
	process.exit(1);
}

const conn = await mysql.createConnection({
	host: env.DB_HOST,
	port: parseInt(env.DB_PORT ?? '3306'),
	user: env.DB_USER,
	password: env.DB_PASSWORD,
	database: env.DB_NAME,
});

const [rows] = await conn.query(
	'SELECT id FROM app_users WHERE display_name = ? AND is_active = TRUE',
	[displayName]
);
if (!rows.length) {
	console.error(`No active user found with display_name "${displayName}"`);
	await conn.end();
	process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
await conn.query('UPDATE app_users SET password_hash = ? WHERE id = ?', [hash, rows[0].id]);
await conn.end();
console.log(`Password set for "${displayName}".`);
