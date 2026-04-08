import 'dotenv/config';
import mysql from 'mysql2/promise';

const db = await mysql.createConnection({
	host:     process.env.DB_HOST     || 'localhost',
	port:     Number(process.env.DB_PORT) || 3306,
	user:     process.env.DB_USER     || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME     || 'pands',
});

const SKUS = [
	// 2.5" thickness
	{ sku_code: '3248',  thickness_in: 2.5, width_in: 48, display_label: '2.5"×48"',  sort_order: 10 },
	{ sku_code: '3272',  thickness_in: 2.5, width_in: 72, display_label: '2.5"×72"',  sort_order: 20 },
	// 3.5" thickness
	{ sku_code: '3036',  thickness_in: 3, width_in: 36, display_label: '3"×36"',  sort_order: 30 },
	{ sku_code: '3048',  thickness_in: 3, width_in: 48, display_label: '3"×48"',  sort_order: 40 },
	{ sku_code: '3060',  thickness_in: 3, width_in: 60, display_label: '3"×60"',  sort_order: 50 },
	{ sku_code: '3072',  thickness_in: 3, width_in: 72, display_label: '3"×72"',  sort_order: 60 },
	// 3.5" thickness
	{ sku_code: '3548',  thickness_in: 3.5, width_in: 48, display_label: '3.5"×48"',  sort_order: 70 },
	{ sku_code: '3560',  thickness_in: 3.5, width_in: 60, display_label: '3.5"×60"',  sort_order: 80 },
	{ sku_code: '3572',  thickness_in: 3.5, width_in: 72, display_label: '3.5"×72"',  sort_order: 90 },
	// 4" thickness
	{ sku_code: '4036',  thickness_in: 4, width_in: 36, display_label: '4"×36"',  sort_order: 100 },
	{ sku_code: '4048',  thickness_in: 4, width_in: 48, display_label: '4"×48"',  sort_order: 110 },
	{ sku_code: '4060',  thickness_in: 4, width_in: 60, display_label: '4"×60"',  sort_order: 120 },
	{ sku_code: '4072',  thickness_in: 4, width_in: 72, display_label: '4"×72"',  sort_order: 130 },
	// 6" thickness
	{ sku_code: '6036',  thickness_in: 6, width_in: 36, display_label: '6"×36"',  sort_order: 140 },
	{ sku_code: '6048',  thickness_in: 6, width_in: 48, display_label: '6"×48"',  sort_order: 150 },
	{ sku_code: '6060',  thickness_in: 6, width_in: 60, display_label: '6"×60"',  sort_order: 160 },
	{ sku_code: '6072',  thickness_in: 6, width_in: 72, display_label: '6"×72"',  sort_order: 170 },
	// 8" thickness
	{ sku_code: '8048',  thickness_in: 8, width_in: 48, display_label: '8"×48"',  sort_order: 180 },
	{ sku_code: '8060',  thickness_in: 8, width_in: 60, display_label: '8"×60"',  sort_order: 190 },
	// 9.5" thickness
	{ sku_code: '9548',  thickness_in: 9.5, width_in: 48, display_label: '9.5"×48"',  sort_order: 200 },
	{ sku_code: '9560',  thickness_in: 9.5, width_in: 60, display_label: '9.5"×60"',  sort_order: 210 },
	{ sku_code: '9572',  thickness_in: 9.5, width_in: 72, display_label: '9.5"×72"',  sort_order: 220 },
];

let inserted = 0;
for (const sku of SKUS) {
	const [result] = await db.query(
		`INSERT IGNORE INTO material_skus (sku_code, thickness_in, width_in, display_label, sort_order)
		 VALUES (?, ?, ?, ?, ?)`,
		[sku.sku_code, sku.thickness_in, sku.width_in, sku.display_label, sku.sort_order]
	);
	if (result.affectedRows > 0) {
		console.log(`  inserted: ${sku.display_label}`);
		inserted++;
	} else {
		console.log(`  skipped (exists): ${sku.display_label}`);
	}
}
console.log(`\nDone. ${inserted} SKU(s) inserted.`);
await db.end();
