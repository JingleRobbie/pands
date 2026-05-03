import { db } from '$lib/db.js';

async function updatePoStatusFromLines(conn, poId) {
	const [[counts]] = await conn.query(
		`SELECT
		   SUM(status = 'OPEN') AS openCount,
		   SUM(status = 'RECEIVED') AS receivedCount
		 FROM purchase_order_lines
		 WHERE po_id = ?`,
		[poId]
	);

	if (Number(counts.openCount) > 0) {
		await conn.query(`UPDATE purchase_orders SET status = 'OPEN' WHERE id = ?`, [poId]);
		return;
	}

	if (Number(counts.receivedCount) > 0) {
		await conn.query(`UPDATE purchase_orders SET status = 'RECEIVED' WHERE id = ?`, [poId]);
	}
}

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
				   (sku_id, transaction_type, sqft_quantity, effective_date, reference_type, reference_id, created_by)
				 VALUES (?, 'RECEIPT', ?, CURDATE(), 'PO_LINE', ?, ?)`,
				[line.sku_id, sqftReceived, lineId, userId]
			);

			await conn.query(
				`UPDATE purchase_order_lines
				 SET status = 'RECEIVED', sqft_received = ?
				 WHERE id = ? AND po_id = ?`,
				[sqftReceived, lineId, poId]
			);
		}

		await updatePoStatusFromLines(conn, poId);

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

/**
 * Reverse received PO lines by appending receipt reversal transactions,
 * reopening the lines, and reopening the PO.
 *
 * @param {number} poId
 * @param {number[]} lineIds
 * @param {number} userId
 */
export async function unreceivePoLines(poId, lineIds, userId) {
	if (lineIds.length === 0) throw new Error('No received PO lines were selected.');

	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		for (const lineId of lineIds) {
			const [[line]] = await conn.query(
				`SELECT id, sku_id, sqft_received
				 FROM purchase_order_lines
				 WHERE id = ? AND po_id = ? AND status = 'RECEIVED'
				 FOR UPDATE`,
				[lineId, poId]
			);
			if (!line) throw new Error(`Line ${lineId} is not a received line on PO ${poId}`);
			if (!line.sqft_received || line.sqft_received < 1) {
				throw new Error(`Line ${lineId} does not have a received quantity to reverse.`);
			}

			const [[receipt]] = await conn.query(
				`SELECT it.id, it.sku_id, it.sqft_quantity, it.effective_date
				 FROM inventory_transactions it
				 WHERE it.reference_type = 'PO_LINE'
				   AND it.reference_id = ?
				   AND it.transaction_type = 'RECEIPT'
				   AND NOT EXISTS (
				     SELECT 1
				     FROM inventory_transactions reversal
				     WHERE reversal.transaction_type = 'RECEIPT_REVERSAL'
				       AND reversal.reverses_transaction_id = it.id
				   )
				 ORDER BY it.created_at DESC, it.id DESC
				 LIMIT 1
				 FOR UPDATE`,
				[lineId]
			);
			if (!receipt) {
				throw new Error(
					`Line ${lineId} does not have an active receipt transaction to reverse.`
				);
			}

			await conn.query(
				`INSERT INTO inventory_transactions
				   (sku_id, transaction_type, sqft_quantity, effective_date, reference_type, reference_id,
				    reverses_transaction_id, memo, created_by)
				 VALUES (?, 'RECEIPT_REVERSAL', ?, ?, 'PO_LINE', ?, ?, ?, ?)`,
				[
					receipt.sku_id,
					receipt.sqft_quantity,
					receipt.effective_date,
					lineId,
					receipt.id,
					`Unreceived PO line ${lineId}`,
					userId ?? null,
				]
			);

			await conn.query(
				`UPDATE purchase_order_lines
				 SET status = 'OPEN', sqft_received = NULL
				 WHERE id = ? AND po_id = ?`,
				[lineId, poId]
			);
		}

		await updatePoStatusFromLines(conn, poId);

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}
