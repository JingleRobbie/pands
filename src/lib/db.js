import mysql from 'mysql2/promise';
import { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } from '$env/static/private';

export const db = mysql.createPool({
	host: DB_HOST,
	port: Number(DB_PORT) || 3306,
	user: DB_USER,
	password: DB_PASSWORD,
	database: DB_NAME,
	waitForConnections: true,
	connectionLimit: 10,
	decimalNumbers: true,   // return DECIMAL columns as JS numbers, not strings
});
