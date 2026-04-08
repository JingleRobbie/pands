import { db } from '$lib/db.js';

export async function receivePoLine(poLineId, sqftReceived, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[line]] = await conn.query(
			'SELECT * FROM purchase_order_lines WHERE id = ? FOR UPDATE',
			[poLineId]
		);
		if (!line) throw new Error('PO line not found.');
		if (line.status === 'RECEIVED') throw new Error('This line has already been received.');

		// Create RECEIPT transaction
		await conn.query(
			`
			INSERT INTO inventory_transactions (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, memo, created_by)
			VALUES (?, 'RECEIPT', ?, 'PO_LINE', ?, ?, ?)
		`,
			[line.sku_id, sqftReceived, poLineId, `Received on PO line ${poLineId}`, userId ?? null]
		);

		// Mark line received
		await conn.query(
			'UPDATE purchase_order_lines SET sqft_received = ?, status = "RECEIVED" WHERE id = ?',
			[sqftReceived, poLineId]
		);

		// Auto-close PO if all lines received
		const [[{ openCount }]] = await conn.query(
			'SELECT COUNT(*) AS openCount FROM purchase_order_lines WHERE po_id = ? AND status = "OPEN"',
			[line.po_id]
		);
		if (openCount === 0) {
			await conn.query('UPDATE purchase_orders SET status = "RECEIVED" WHERE id = ?', [
				line.po_id,
			]);
		}

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}
