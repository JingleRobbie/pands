import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const db = await mysql.createConnection({
	host: process.env.DB_HOST || 'localhost',
	port: Number(process.env.DB_PORT) || 3306,
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'pands',
});

const SKUS = [
	// 2.5" thickness
	{
		sku_code: '3248',
		thickness_in: 2.5,
		width_in: 48,
		r_value: 'R-7',
		display_label: '2.5"×48"',
		sort_order: 10,
	},
	{
		sku_code: '3272',
		thickness_in: 2.5,
		width_in: 72,
		r_value: 'R-7',
		display_label: '2.5"×72"',
		sort_order: 20,
	},
	// 3" thickness
	{
		sku_code: '3036',
		thickness_in: 3,
		width_in: 36,
		r_value: 'R-10',
		display_label: '3"×36"',
		sort_order: 30,
	},
	{
		sku_code: '3048',
		thickness_in: 3,
		width_in: 48,
		r_value: 'R-10',
		display_label: '3"×48"',
		sort_order: 40,
	},
	{
		sku_code: '3060',
		thickness_in: 3,
		width_in: 60,
		r_value: 'R-10',
		display_label: '3"×60"',
		sort_order: 50,
	},
	{
		sku_code: '3072',
		thickness_in: 3,
		width_in: 72,
		r_value: 'R-10',
		display_label: '3"×72"',
		sort_order: 60,
	},
	// 3.5" thickness
	{
		sku_code: '3548',
		thickness_in: 3.5,
		width_in: 48,
		r_value: 'R-11',
		display_label: '3.5"×48"',
		sort_order: 70,
	},
	{
		sku_code: '3560',
		thickness_in: 3.5,
		width_in: 60,
		r_value: 'R-11',
		display_label: '3.5"×60"',
		sort_order: 80,
	},
	{
		sku_code: '3572',
		thickness_in: 3.5,
		width_in: 72,
		r_value: 'R-11',
		display_label: '3.5"×72"',
		sort_order: 90,
	},
	// 4" thickness
	{
		sku_code: '4036',
		thickness_in: 4,
		width_in: 36,
		r_value: 'R-13',
		display_label: '4"×36"',
		sort_order: 100,
	},
	{
		sku_code: '4048',
		thickness_in: 4,
		width_in: 48,
		r_value: 'R-13',
		display_label: '4"×48"',
		sort_order: 110,
	},
	{
		sku_code: '4060',
		thickness_in: 4,
		width_in: 60,
		r_value: 'R-13',
		display_label: '4"×60"',
		sort_order: 120,
	},
	{
		sku_code: '4072',
		thickness_in: 4,
		width_in: 72,
		r_value: 'R-13',
		display_label: '4"×72"',
		sort_order: 130,
	},
	// 6" thickness
	{
		sku_code: '6036',
		thickness_in: 6,
		width_in: 36,
		r_value: 'R-19',
		display_label: '6"×36"',
		sort_order: 140,
	},
	{
		sku_code: '6048',
		thickness_in: 6,
		width_in: 48,
		r_value: 'R-19',
		display_label: '6"×48"',
		sort_order: 150,
	},
	{
		sku_code: '6060',
		thickness_in: 6,
		width_in: 60,
		r_value: 'R-19',
		display_label: '6"×60"',
		sort_order: 160,
	},
	{
		sku_code: '6072',
		thickness_in: 6,
		width_in: 72,
		r_value: 'R-19',
		display_label: '6"×72"',
		sort_order: 170,
	},
	// 8" thickness
	{
		sku_code: '8048',
		thickness_in: 8,
		width_in: 48,
		r_value: 'R-25',
		display_label: '8"×48"',
		sort_order: 180,
	},
	{
		sku_code: '8060',
		thickness_in: 8,
		width_in: 60,
		r_value: 'R-25',
		display_label: '8"×60"',
		sort_order: 190,
	},
	// 9.5" thickness
	{
		sku_code: '9548',
		thickness_in: 9.5,
		width_in: 48,
		r_value: 'R-30',
		display_label: '9.5"×48"',
		sort_order: 200,
	},
	{
		sku_code: '9560',
		thickness_in: 9.5,
		width_in: 60,
		r_value: 'R-30',
		display_label: '9.5"×60"',
		sort_order: 210,
	},
	{
		sku_code: '9572',
		thickness_in: 9.5,
		width_in: 72,
		r_value: 'R-30',
		display_label: '9.5"×72"',
		sort_order: 220,
	},
];

let inserted = 0;
for (const sku of SKUS) {
	const [result] = await db.query(
		`INSERT INTO material_skus (sku_code, thickness_in, width_in, r_value, display_label, sort_order)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE r_value = VALUES(r_value)`,
		[
			sku.sku_code,
			sku.thickness_in,
			sku.width_in,
			sku.r_value,
			sku.display_label,
			sku.sort_order,
		]
	);
	if (result.affectedRows === 1) {
		console.log(`  inserted: ${sku.display_label}`);
		inserted++;
	} else {
		console.log(`  skipped (exists): ${sku.display_label}`);
	}
}
console.log(`\nDone. ${inserted} SKU(s) inserted.`);

// Seed raw roll lookup
const RAW_ROLLS = [
	['Johns Manville', 'R-7', 2.5, 48, 100],
	['Johns Manville', 'R-7', 2.5, 72, 100],
	['Certainteed', 'R-7', 2.5, 48, 100],
	['Certainteed', 'R-7', 2.5, 72, 100],
	['Johns Manville', 'R-10', 3.0, 36, 100],
	['Johns Manville', 'R-10', 3.0, 48, 100],
	['Johns Manville', 'R-10', 3.0, 60, 100],
	['Johns Manville', 'R-10', 3.0, 72, 100],
	['Certainteed', 'R-10', 3.0, 36, 100],
	['Certainteed', 'R-10', 3.0, 48, 100],
	['Certainteed', 'R-10', 3.0, 60, 100],
	['Certainteed', 'R-10', 3.0, 72, 100],
	['Johns Manville', 'R-11', 3.5, 48, 75],
	['Johns Manville', 'R-11', 3.5, 60, 75],
	['Johns Manville', 'R-11', 3.5, 72, 75],
	['Certainteed', 'R-11', 3.5, 48, 100],
	['Certainteed', 'R-11', 3.5, 60, 100],
	['Certainteed', 'R-11', 3.5, 72, 100],
	['Johns Manville', 'R-13', 4.0, 36, 75],
	['Johns Manville', 'R-13', 4.0, 48, 75],
	['Johns Manville', 'R-13', 4.0, 60, 75],
	['Johns Manville', 'R-13', 4.0, 72, 75],
	['Certainteed', 'R-13', 4.0, 36, 75],
	['Certainteed', 'R-13', 4.0, 48, 75],
	['Certainteed', 'R-13', 4.0, 60, 75],
	['Certainteed', 'R-13', 4.0, 72, 75],
	['Johns Manville', 'R-19', 6.0, 36, 50],
	['Johns Manville', 'R-19', 6.0, 48, 50],
	['Johns Manville', 'R-19', 6.0, 60, 50],
	['Johns Manville', 'R-19', 6.0, 72, 50],
	['Certainteed', 'R-19', 6.0, 36, 50],
	['Certainteed', 'R-19', 6.0, 48, 50],
	['Certainteed', 'R-19', 6.0, 60, 50],
	['Certainteed', 'R-19', 6.0, 72, 50],
	['Johns Manville', 'R-25', 8.0, 48, 30],
	['Johns Manville', 'R-25', 8.0, 60, 30],
	['Certainteed', 'R-25', 8.0, 48, 30],
	['Certainteed', 'R-25', 8.0, 60, 30],
	['Johns Manville', 'R-30', 9.5, 48, 27],
	['Johns Manville', 'R-30', 9.5, 60, 27],
	['Johns Manville', 'R-30', 9.5, 72, 27],
	['Certainteed', 'R-30', 9.5, 48, 25],
	['Certainteed', 'R-30', 9.5, 60, 25],
	['Certainteed', 'R-30', 9.5, 72, 25],
];
let lookupUpserted = 0;
for (const [vendor, rValue, thickness, width, length] of RAW_ROLLS) {
	const [r] = await db.query(
		`INSERT INTO raw_roll_lookup (vendor, r_value, thickness_in, width_in, roll_length_ft)
		 VALUES (?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		   roll_length_ft = VALUES(roll_length_ft)`,
		[vendor, rValue, thickness, width, length]
	);
	if (r.affectedRows > 0) lookupUpserted++;
}
console.log(`\n${lookupUpserted} raw roll lookup row(s) inserted or updated.`);

// Seed Admin user with default password
const adminHash = await bcrypt.hash('12345', 10);
await db.query(
	`INSERT INTO app_users (id, display_name, role, password_hash)
	 VALUES (1, 'Admin', 'admin', ?)
	 ON DUPLICATE KEY UPDATE password_hash = IF(password_hash IS NULL, VALUES(password_hash), password_hash)`,
	[adminHash]
);
console.log('\nAdmin user ready (password unchanged if already set).');

await db.end();
