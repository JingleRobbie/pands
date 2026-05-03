import { db } from '$lib/db.js';

/**
 * Mark a set of open PO lines as received, create RECEIPT inventory transactions,
 * and close the PO if no open lines remain.
 *
 * @param {number} poId
 * @param {{ lineId: number, sqftReceived: number }[]} receipts
 * @param {number} userId
 */
export async function receivePoLines(poId, receipts, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		for (const { lineId, sqftReceived } of receipts) {
			// Fetch sku_id from the DB — never trust the client for this
			const [[line]] = await conn.query(
				'SELECT sku_id FROM purchase_order_lines WHERE id = ? AND po_id = ? AND status = ?',
				[lineId, poId, 'OPEN']
			);
			if (!line) throw new Error(`Line ${lineId} is not an open line on PO ${poId}`);

			await conn.query(
				`INSERT INTO inventory_transactions
				   (sku_id, transaction_type, sqft_quantity, reference_type, reference_id, created_by)
				 VALUES (?, 'RECEIPT', ?, 'PO_LINE', ?, ?)`,
				[line.sku_id, sqftReceived, lineId, userId]
			);

			await conn.query(
				`UPDATE purchase_order_lines
				 SET status = 'RECEIVED', sqft_received = ?
				 WHERE id = ? AND po_id = ?`,
				[sqftReceived, lineId, poId]
			);
		}

		// Close the PO if no OPEN lines remain
		const [[{ openCount }]] = await conn.query(
			`SELECT COUNT(*) AS openCount
			 FROM purchase_order_lines
			 WHERE po_id = ? AND status = 'OPEN'`,
			[poId]
		);
		if (openCount === 0) {
			await conn.query(`UPDATE purchase_orders SET status = 'RECEIVED' WHERE id = ?`, [poId]);
		}

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

/**
 * Reverse received PO lines by reopening the lines and reopening the PO.
 *
 * @param {number} poId
 * @param {number[]} lineIds
 * @param {number} _userId
 */
export async function unreceivePoLines(poId, lineIds, _userId) {
	if (lineIds.length === 0) throw new Error('No received PO lines were selected.');

	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		for (const lineId of lineIds) {
			const [[line]] = await conn.query(
				`SELECT id, sku_id, sqft_received
				 FROM purchase_order_lines
				 WHERE id = ? AND po_id = ? AND status = 'RECEIVED'`,
				[lineId, poId]
			);
			if (!line) throw new Error(`Line ${lineId} is not a received line on PO ${poId}`);
			if (!line.sqft_received || line.sqft_received < 1) {
				throw new Error(`Line ${lineId} does not have a received quantity to reverse.`);
			}

			await conn.query(
				`UPDATE purchase_order_lines
				 SET status = 'OPEN', sqft_received = NULL
				 WHERE id = ? AND po_id = ?`,
				[lineId, poId]
			);
		}

		await conn.query(`UPDATE purchase_orders SET status = 'OPEN' WHERE id = ?`, [poId]);

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}
