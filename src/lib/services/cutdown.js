import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

// NOTE: Duplicate of calcSqft() in runs.js.
// Copy is intentional — do not import across service files.
function calcSqft(line, rolls) {
	return Math.round(Number(rolls) * (Number(line.width_in) / 12) * Number(line.length_ft));
}

function calcRawRollSqft(cutDown, rolls) {
	if (!cutDown.raw_roll_width_in || !cutDown.raw_roll_length_ft) {
		throw new Error('Cut-down is missing raw roll dimensions.');
	}
	return Math.round(
		Number(rolls) *
			(Number(cutDown.raw_roll_width_in) / 12) *
			Number(cutDown.raw_roll_length_ft)
	);
}

function calcScheduledRawRolls(line, lookup) {
	const sqftPerRoll = (Number(lookup.width_in) / 12) * Number(lookup.roll_length_ft);
	const rollsScheduled = Math.ceil(Number(line.sqft) / sqftPerRoll);
	const sqftScheduled = Math.round(rollsScheduled * sqftPerRoll);
	return { rollsScheduled, sqftScheduled };
}

async function nextCutDownNumber(conn) {
	const [[{ last }]] = await conn.query(
		"SELECT MAX(cut_down_number) AS last FROM cut_downs WHERE cut_down_number LIKE 'CD-%'"
	);
	const seq = last ? parseInt(last.slice(3)) + 1 : 1;
	return `CD-${String(seq).padStart(6, '0')}`;
}

function validateProductionWidths(line, productionWidths) {
	if (!productionWidths || productionWidths.length === 0)
		throw new Error('At least one production width is required.');

	for (const pw of productionWidths) {
		if (!pw.width_in || Number(pw.width_in) <= 0)
			throw new Error('Production width is required.');
		if (Number(pw.width_in) > Number(line.width_in))
			throw new Error(
				`Production width ${pw.width_in}" exceeds source width ${line.width_in}".`
			);
		if (pw.qty != null && Number(pw.qty) <= 0)
			throw new Error('Production quantity must be greater than zero.');
		if (pw.length_ft != null && Number(pw.length_ft) <= 0)
			throw new Error('Production length must be greater than zero.');
	}
}

async function insertProductionLines(conn, line, productionWidths) {
	const newIds = [];
	for (const pw of productionWidths) {
		const prodLine = {
			wo_id: line.wo_id,
			parent_line_id: line.id,
			sku_id: line.sku_id,
			thickness_in: line.thickness_in,
			width_in: pw.width_in,
			qty: pw.qty ?? line.qty,
			length_ft: pw.length_ft ?? line.length_ft,
			facing: line.facing,
			rollfor: line.rollfor,
			tab_type: line.tab_type,
			instructions: line.instructions,
			rolls_produced: 0,
			reconciliation_status: 'CURRENT',
			path_type: null,
		};
		prodLine.sqft = calcSqft(prodLine, prodLine.qty);

		const [{ insertId }] = await conn.query(
			`INSERT INTO work_order_lines
			 (wo_id, parent_line_id, sku_id, thickness_in, width_in, qty, length_ft, sqft,
			  facing, rollfor, tab_type, instructions, rolls_produced, reconciliation_status, path_type)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				prodLine.wo_id,
				prodLine.parent_line_id,
				prodLine.sku_id,
				prodLine.thickness_in,
				prodLine.width_in,
				prodLine.qty,
				prodLine.length_ft,
				prodLine.sqft,
				prodLine.facing,
				prodLine.rollfor,
				prodLine.tab_type,
				prodLine.instructions,
				prodLine.rolls_produced,
				prodLine.reconciliation_status,
				prodLine.path_type,
			]
		);
		newIds.push(insertId);
	}
	return newIds;
}

async function queryBranchEditBlockers(queryable, billingLineId) {
	const [rows] = await queryable.query(
		`SELECT blocker
		 FROM (
		   SELECT 'cut-down' AS blocker
		   FROM cut_downs
		   WHERE billing_line_id = ?
		   LIMIT 1
		 ) cd
		 UNION ALL
		 SELECT blocker
		 FROM (
		   SELECT 'production run' AS blocker
		   FROM production_runs pr
		   JOIN work_order_lines child ON child.id = pr.wo_line_id
		   WHERE child.parent_line_id = ?
		   LIMIT 1
		 ) pr
		 UNION ALL
		 SELECT blocker
		 FROM (
		   SELECT 'WIP ledger entry' AS blocker
		   FROM wip_ledger wl
		   JOIN work_order_lines child ON child.id = wl.wo_line_id
		   WHERE child.parent_line_id = ?
		   LIMIT 1
		 ) wl
		 UNION ALL
		 SELECT blocker
		 FROM (
		   SELECT 'shipment' AS blocker
		   FROM shipment_lines sl
		   LEFT JOIN work_order_lines direct_child ON direct_child.id = sl.wo_line_id
		   LEFT JOIN production_runs pr ON pr.id = sl.production_run_id
		   LEFT JOIN work_order_lines run_child ON run_child.id = pr.wo_line_id
		   WHERE direct_child.parent_line_id = ? OR run_child.parent_line_id = ?
		   LIMIT 1
		 ) sl`,
		[billingLineId, billingLineId, billingLineId, billingLineId, billingLineId]
	);
	return rows.map((row) => row.blocker);
}

export async function getBranchEditBlockers(billingLineId) {
	return queryBranchEditBlockers(db, billingLineId);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Branch an unbranched work_order_line into a billing line + one or more
 * production lines. The original row becomes the billing line (no column changes
 * needed — line type is derived from parent_line_id). New production rows are
 * inserted as children.
 *
 * @param {number} woLineId - the unbranched line to branch
 * @param {number} woId - owning work order id
 * @param {{ width_in: number, qty?: number, length_ft?: number }[]} productionWidths
 * @param {number} userId
 * @returns {Promise<number[]>} ids of the new production lines
 */
export async function branchLine(woLineId, woId, productionWidths, _userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[line]] = await conn.query(
			'SELECT * FROM work_order_lines WHERE id = ? AND wo_id = ? FOR UPDATE',
			[woLineId, woId]
		);
		if (!line) throw new Error('WO line not found.');
		if (line.parent_line_id !== null)
			throw new Error(
				'Cannot branch a production line — only unbranched lines can be branched.'
			);

		const [[{ childCount }]] = await conn.query(
			'SELECT COUNT(*) AS childCount FROM work_order_lines WHERE parent_line_id = ?',
			[woLineId]
		);
		if (Number(childCount) > 0) throw new Error('Line has already been branched.');

		const [[{ runCount }]] = await conn.query(
			"SELECT COUNT(*) AS runCount FROM production_runs WHERE wo_line_id = ? AND status != 'COMPLETED'",
			[woLineId]
		);
		if (Number(runCount) > 0)
			throw new Error('Cannot branch a line that has open production runs.');

		validateProductionWidths(line, productionWidths);
		const newIds = await insertProductionLines(conn, line, productionWidths);

		await conn.commit();
		return newIds;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

/**
 * Replace the production children for an existing branched billing line.
 * Editing is only allowed before any downstream cut-down, run, WIP, or shipment
 * activity references the branch.
 *
 * @param {number} billingLineId - the existing billing/source line
 * @param {number} woId - owning work order id
 * @param {{ width_in: number, qty?: number, length_ft?: number }[]} productionWidths
 * @param {number} userId
 * @returns {Promise<number[]>} ids of the replacement production lines
 */
export async function updateBranchLine(billingLineId, woId, productionWidths, _userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[line]] = await conn.query(
			'SELECT * FROM work_order_lines WHERE id = ? AND wo_id = ? FOR UPDATE',
			[billingLineId, woId]
		);
		if (!line) throw new Error('WO line not found.');
		if (line.parent_line_id !== null)
			throw new Error('Cannot edit a production line branch from a child line.');

		const [children] = await conn.query(
			'SELECT * FROM work_order_lines WHERE parent_line_id = ? ORDER BY id FOR UPDATE',
			[billingLineId]
		);
		if (children.length === 0) throw new Error('Line has not been branched.');

		const blockers = await queryBranchEditBlockers(conn, billingLineId);
		if (blockers.length > 0)
			throw new Error(
				`Cannot edit branch because it has downstream ${blockers.join(', ')} activity.`
			);

		validateProductionWidths(line, productionWidths);

		await conn.query('DELETE FROM work_order_lines WHERE parent_line_id = ?', [billingLineId]);
		const newIds = await insertProductionLines(conn, line, productionWidths);

		await conn.commit();
		return newIds;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

/**
 * Exported pure read — used by runs.js inside its own transaction.
 * Finds the confirmed cut-down linked to a production line via its billing parent.
 */
export async function getConfirmedCutDownForProductionLine(conn, woLineId) {
	const [[line]] = await conn.query('SELECT parent_line_id FROM work_order_lines WHERE id = ?', [
		woLineId,
	]);
	if (!line || line.parent_line_id === null)
		throw new Error(`WO line ${woLineId} is not a production line.`);

	const [[cutDown]] = await conn.query(
		"SELECT * FROM cut_downs WHERE billing_line_id = ? AND status = 'COMPLETED' ORDER BY confirmed_at DESC LIMIT 1",
		[line.parent_line_id]
	);
	if (!cutDown)
		throw new Error(`No confirmed cut-down found for billing line ${line.parent_line_id}.`);
	return cutDown;
}

// ─── Internal helpers (also used by later functions in this file) ──────────────

async function insertWipLedgerEntry(
	conn,
	{ transactionType, cutDownId, woLineId, widthIn, sqftQuantity, memo, userId }
) {
	await conn.query(
		`INSERT INTO wip_ledger
		 (transaction_type, cut_down_id, wo_line_id, width_in, sqft_quantity, effective_date, memo, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			transactionType,
			cutDownId ?? null,
			woLineId ?? null,
			widthIn,
			sqftQuantity,
			localDate(),
			memo ?? null,
			userId ?? null,
		]
	);
}

async function getCutDownWipBalance(conn, cutDownId) {
	const [[{ balance }]] = await conn.query(
		'SELECT COALESCE(SUM(sqft_quantity), 0) AS balance FROM wip_ledger WHERE cut_down_id = ?',
		[cutDownId]
	);
	return Number(balance);
}

async function findRawRollLookup(conn, line, vendorName) {
	const [[lookup]] = await conn.query(
		`SELECT rrl.*
		 FROM raw_roll_lookup rrl
		 JOIN material_skus ms ON ms.id = ?
		 WHERE rrl.vendor = ?
		   AND rrl.r_value = ms.r_value
		   AND rrl.thickness_in = ?
		   AND rrl.width_in = ?
		 LIMIT 1`,
		[line.sku_id, vendorName, line.thickness_in, line.width_in]
	);
	return lookup;
}

function validateCutDownConfirmable(cutDown, rollsActual) {
	if (!cutDown) throw new Error('Cut-down not found.');
	if (cutDown.status === 'COMPLETED') throw new Error('Cut-down is already completed.');
	if (rollsActual > cutDown.rolls_scheduled)
		throw new Error(
			`Cannot record ${rollsActual} rolls — only ${cutDown.rolls_scheduled} were scheduled.`
		);
}

async function markBillingLineStale(conn, billingLineId) {
	await conn.query(
		`UPDATE work_order_lines
		 SET reconciliation_status = 'STALE'
		 WHERE id = ? AND reconciliation_status != 'SUPERSEDED'`,
		[billingLineId]
	);
}

// ─── Cut-down scheduling ───────────────────────────────────────────────────────

export async function scheduleCutDown(billingLineId, vendor, runDate, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[line]] = await conn.query(
			'SELECT * FROM work_order_lines WHERE id = ? FOR UPDATE',
			[billingLineId]
		);
		if (!line) throw new Error('WO line not found.');
		if (line.parent_line_id !== null)
			throw new Error('Cut-downs can only be scheduled against billing lines.');

		const [[{ childCount }]] = await conn.query(
			'SELECT COUNT(*) AS childCount FROM work_order_lines WHERE parent_line_id = ?',
			[billingLineId]
		);
		if (Number(childCount) === 0)
			throw new Error('Line must be branched before scheduling a cut-down.');

		const [[existing]] = await conn.query(
			"SELECT id FROM cut_downs WHERE billing_line_id = ? AND status != 'COMPLETED' LIMIT 1",
			[billingLineId]
		);
		if (existing)
			throw new Error('An active cut-down already exists for this line. Delete it first.');

		const vendorName = vendor === 'CT' ? 'Certainteed' : 'Johns Manville';
		const lookup = await findRawRollLookup(conn, line, vendorName);
		if (!lookup)
			throw new Error(
				`No raw roll data for ${line.thickness_in}"×${line.width_in}" (${vendorName}). Contact admin.`
			);

		const { rollsScheduled, sqftScheduled } = calcScheduledRawRolls(line, lookup);

		const cutDownNumber = await nextCutDownNumber(conn);
		const status = runDate ? 'SCHEDULED' : 'UNSCHEDULED';

		await conn.query(
			`INSERT INTO cut_downs
			 (cut_down_number, wo_id, billing_line_id, sku_id, run_date, status,
			  rolls_scheduled, raw_roll_lookup_id, raw_vendor, raw_roll_length_ft, raw_roll_width_in,
			  sqft_scheduled, created_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				cutDownNumber,
				line.wo_id,
				billingLineId,
				line.sku_id,
				runDate ?? null,
				status,
				rollsScheduled,
				lookup.id,
				vendorName,
				lookup.roll_length_ft,
				lookup.width_in,
				sqftScheduled,
				userId ?? null,
			]
		);

		await conn.commit();
		return cutDownNumber;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function scheduleCutDownGroup(woId, items, runDate, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const seenBillingLineIds = new Set();
		for (const { billingLineId } of items) {
			const normalizedId = Number(billingLineId);
			if (seenBillingLineIds.has(normalizedId)) {
				throw new Error(`Line ${billingLineId} was selected more than once.`);
			}
			seenBillingLineIds.add(normalizedId);
		}

		// Validate all billing lines belong to this WO
		for (const { billingLineId } of items) {
			const [[line]] = await conn.query('SELECT wo_id FROM work_order_lines WHERE id = ?', [
				billingLineId,
			]);
			if (!line || Number(line.wo_id) !== Number(woId))
				throw new Error(`Line ${billingLineId} does not belong to WO ${woId}.`);

			const [[existing]] = await conn.query(
				"SELECT id FROM cut_downs WHERE billing_line_id = ? AND status != 'COMPLETED' LIMIT 1",
				[billingLineId]
			);
			if (existing) {
				throw new Error(
					`An active cut-down already exists for line ${billingLineId}. Delete it first.`
				);
			}
		}

		const [{ insertId: groupId }] = await conn.query(
			'INSERT INTO cut_down_groups (wo_id, created_by) VALUES (?, ?)',
			[woId, userId ?? null]
		);

		for (const { billingLineId, vendor } of items) {
			const [[line]] = await conn.query(
				'SELECT * FROM work_order_lines WHERE id = ? FOR UPDATE',
				[billingLineId]
			);
			const vendorName = vendor === 'CT' ? 'Certainteed' : 'Johns Manville';
			const lookup = await findRawRollLookup(conn, line, vendorName);
			if (!lookup)
				throw new Error(
					`No raw roll data for ${line.thickness_in}"×${line.width_in}" (${vendorName}).`
				);
			const { rollsScheduled, sqftScheduled } = calcScheduledRawRolls(line, lookup);
			const cutDownNumber = await nextCutDownNumber(conn);
			const status = runDate ? 'SCHEDULED' : 'UNSCHEDULED';

			await conn.query(
				`INSERT INTO cut_downs
				 (cut_down_number, group_id, wo_id, billing_line_id, sku_id, run_date, status,
				  rolls_scheduled, raw_roll_lookup_id, raw_vendor, raw_roll_length_ft, raw_roll_width_in,
				  sqft_scheduled, created_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					cutDownNumber,
					groupId,
					woId,
					billingLineId,
					line.sku_id,
					runDate ?? null,
					status,
					rollsScheduled,
					lookup.id,
					vendorName,
					lookup.roll_length_ft,
					lookup.width_in,
					sqftScheduled,
					userId ?? null,
				]
			);
		}

		await conn.commit();
		return groupId;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

// ─── Cut-down confirmation ─────────────────────────────────────────────────────

export async function confirmCutDown(
	cutDownId,
	rollsActual,
	sqftActualOverride,
	wasteActual,
	scrapDisposition,
	operatorNotes,
	userId
) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[cutDown]] = await conn.query('SELECT * FROM cut_downs WHERE id = ? FOR UPDATE', [
			cutDownId,
		]);
		validateCutDownConfirmable(cutDown, rollsActual);

		const [[billingLine]] = await conn.query(
			`SELECT wol.*, wo.so_number, wo.job_name
			 FROM work_order_lines wol
			 JOIN work_orders wo ON wo.id = wol.wo_id
			 WHERE wol.id = ? FOR UPDATE`,
			[cutDown.billing_line_id]
		);

		const sqftActual = sqftActualOverride ?? calcRawRollSqft(cutDown, rollsActual);

		// Write inventory CONSUMPTION for the source SKU
		await conn.query(
			`INSERT INTO inventory_transactions
			 (sku_id, transaction_type, sqft_quantity, effective_date, reference_type, reference_id, memo, created_by)
			 VALUES (?, 'CONSUMPTION', ?, CURDATE(), 'CUT_DOWN', ?, ?, ?)`,
			[
				cutDown.sku_id,
				sqftActual,
				cutDownId,
				`Cut-down ${cutDown.cut_down_number} — ${billingLine.so_number} ${billingLine.job_name}`,
				userId ?? null,
			]
		);

		// Write WIP CUT_IN entries — prorate billing line sqft (usable output), not raw source sqft
		const [productionLines] = await conn.query(
			'SELECT * FROM work_order_lines WHERE parent_line_id = ?',
			[cutDown.billing_line_id]
		);

		const usableOutputSqft = Number(billingLine.sqft);
		const totalChildWidth = productionLines.reduce((s, l) => s + Number(l.width_in), 0);
		let allocatedSqft = 0;

		for (let i = 0; i < productionLines.length; i++) {
			const prodLine = productionLines[i];
			const isLast = i === productionLines.length - 1;
			const proratedSqft = isLast
				? usableOutputSqft - allocatedSqft
				: Math.round(
						totalChildWidth > 0
							? (Number(prodLine.width_in) / totalChildWidth) * usableOutputSqft
							: usableOutputSqft / productionLines.length
					);
			allocatedSqft += proratedSqft;
			await insertWipLedgerEntry(conn, {
				transactionType: 'CUT_IN',
				cutDownId,
				woLineId: prodLine.id,
				widthIn: prodLine.width_in,
				sqftQuantity: proratedSqft,
				memo: `Cut-down ${cutDown.cut_down_number} — ${prodLine.width_in}" cut`,
				userId,
			});
		}

		// Scrap = raw source consumed minus usable cut output (raw roll overage)
		const scrapSqft = sqftActual - usableOutputSqft;

		if (scrapSqft > 0) {
			await insertWipLedgerEntry(conn, {
				transactionType: 'SCRAP',
				cutDownId,
				woLineId: null,
				widthIn: billingLine.width_in,
				sqftQuantity: scrapSqft,
				memo: `Cut-down ${cutDown.cut_down_number} — scrap saved`,
				userId,
			});
		}

		if (scrapDisposition === 'DISCARDED' && scrapSqft > 0) {
			await insertWipLedgerEntry(conn, {
				transactionType: 'SCRAP',
				cutDownId,
				woLineId: null,
				widthIn: billingLine.width_in,
				sqftQuantity: -scrapSqft,
				memo: `Cut-down ${cutDown.cut_down_number} — scrap discarded`,
				userId,
			});
		}

		await conn.query(
			`UPDATE cut_downs
			 SET rolls_actual = ?, sqft_actual = ?, waste_sqft_actual = ?,
			     scrap_disposition = ?, operator_notes = ?,
			     status = 'COMPLETED', confirmed_at = NOW(), confirmed_by = ?
			 WHERE id = ?`,
			[
				rollsActual,
				sqftActual,
				wasteActual ?? null,
				scrapDisposition ?? null,
				operatorNotes ?? null,
				userId ?? null,
				cutDownId,
			]
		);

		await conn.commit();
		return { cutDownId, sqftActual, scrapDisposition };
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function unconfirmCutDown(cutDownId, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[cutDown]] = await conn.query('SELECT * FROM cut_downs WHERE id = ? FOR UPDATE', [
			cutDownId,
		]);
		if (!cutDown) throw new Error('Cut-down not found.');
		if (cutDown.status !== 'COMPLETED') throw new Error('Cut-down is not completed.');

		// Collect downstream warnings (soft gate — do not block)
		const [completedRuns] = await conn.query(
			`SELECT pr.run_number FROM production_runs pr
			 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
			 WHERE wol.parent_line_id = ? AND pr.status = 'COMPLETED'`,
			[cutDown.billing_line_id]
		);
		const [linkedShipments] = await conn.query(
			`SELECT s.shipment_number FROM shipments s
			 JOIN shipment_lines sl ON sl.shipment_id = s.id
			 WHERE sl.cut_down_id = ?`,
			[cutDownId]
		);

		// Reverse inventory CONSUMPTION
		const [[consumption]] = await conn.query(
			`SELECT id FROM inventory_transactions
			 WHERE reference_type = 'CUT_DOWN' AND reference_id = ? AND transaction_type = 'CONSUMPTION'
			 LIMIT 1`,
			[cutDownId]
		);
		if (consumption) {
			await conn.query(
				`INSERT INTO inventory_transactions
				 (sku_id, transaction_type, sqft_quantity, effective_date, reference_type, reference_id,
				  reverses_transaction_id, memo, created_by)
				 SELECT sku_id, 'CONSUMPTION_REVERSAL', sqft_quantity, effective_date,
				        'CUT_DOWN', reference_id, id, CONCAT('Reversal of cut-down ', ?), ?
				 FROM inventory_transactions WHERE id = ?`,
				[cutDown.cut_down_number, userId ?? null, consumption.id]
			);
		}

		// Clear WIP CUT_IN and SCRAP entries (not CUT_OUT — those belong to runs)
		await conn.query(
			"DELETE FROM wip_ledger WHERE cut_down_id = ? AND transaction_type IN ('CUT_IN', 'SCRAP')",
			[cutDownId]
		);

		// Reopen cut-down
		const reopenedStatus = cutDown.run_date ? 'SCHEDULED' : 'UNSCHEDULED';
		await conn.query(
			`UPDATE cut_downs
			 SET status = ?, rolls_actual = NULL, sqft_actual = NULL, waste_sqft_actual = NULL,
			     source_roll_count = NULL, scrap_disposition = NULL, operator_notes = NULL,
			     confirmed_at = NULL, confirmed_by = NULL
			 WHERE id = ?`,
			[reopenedStatus, cutDownId]
		);

		// Mark billing line stale
		await markBillingLineStale(conn, cutDown.billing_line_id);

		await conn.commit();
		return {
			warnings: {
				runNumbers: completedRuns.map((r) => r.run_number),
				shipmentNumbers: linkedShipments.map((s) => s.shipment_number),
			},
		};
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function deleteCutDown(cutDownId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();
		const [[cutDown]] = await conn.query('SELECT * FROM cut_downs WHERE id = ? FOR UPDATE', [
			cutDownId,
		]);
		if (!cutDown) throw new Error('Cut-down not found.');
		if (cutDown.status === 'COMPLETED') throw new Error('Cannot delete a completed cut-down.');
		await conn.query('DELETE FROM cut_downs WHERE id = ?', [cutDownId]);
		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

// ─── Scrap assignment ──────────────────────────────────────────────────────────

export async function assignScrap(sourceCutDownId, destinationWoLineId, sqftToAssign, userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[cutDown]] = await conn.query('SELECT * FROM cut_downs WHERE id = ?', [
			sourceCutDownId,
		]);
		if (!cutDown || cutDown.status !== 'COMPLETED')
			throw new Error('Source cut-down not found or not completed.');

		const [[destLine]] = await conn.query('SELECT * FROM work_order_lines WHERE id = ?', [
			destinationWoLineId,
		]);
		if (!destLine || destLine.parent_line_id === null)
			throw new Error('Destination must be a production line.');

		// Width tolerance check — use actual WIP width from ledger
		const [[{ wipWidth }]] = await conn.query(
			'SELECT width_in AS wipWidth FROM wip_ledger WHERE cut_down_id = ? AND transaction_type = ? LIMIT 1',
			[sourceCutDownId, 'CUT_IN']
		);
		const sourceWidth = Number(wipWidth ?? cutDown.sku_id); // fallback; wipWidth preferred
		const destWidth = Number(destLine.width_in);

		if (sourceWidth < destWidth)
			throw new Error(`Scrap is too narrow (${sourceWidth}" < ${destWidth}").`);
		if (sourceWidth > destWidth + 2)
			throw new Error(
				`Scrap exceeds 2" width tolerance (${sourceWidth}" vs ${destWidth}" required).`
			);

		const balance = await getCutDownWipBalance(conn, sourceCutDownId);
		if (balance < sqftToAssign)
			throw new Error(
				`Insufficient WIP balance — ${balance} sqft available, ${sqftToAssign} requested.`
			);

		await insertWipLedgerEntry(conn, {
			transactionType: 'CUT_OUT',
			cutDownId: sourceCutDownId,
			woLineId: destinationWoLineId,
			widthIn: sourceWidth,
			sqftQuantity: -sqftToAssign,
			memo: `Scrap assigned to WO line ${destinationWoLineId}`,
			userId,
		});

		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

// ─── Billing reconciliation ────────────────────────────────────────────────────

export async function reconcileBillingLine(
	billingLineId,
	{ newSkuId, newWidthIn, newQty, newLengthFt } = {},
	_userId
) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[line]] = await conn.query(
			'SELECT * FROM work_order_lines WHERE id = ? FOR UPDATE',
			[billingLineId]
		);
		if (!line) throw new Error('Billing line not found.');
		if (line.reconciliation_status !== 'STALE')
			throw new Error('Line is not stale — nothing to reconcile.');

		const updates = {};
		if (newSkuId != null) updates.sku_id = newSkuId;
		if (newWidthIn != null) updates.width_in = newWidthIn;
		if (newQty != null) updates.qty = newQty;
		if (newLengthFt != null) updates.length_ft = newLengthFt;
		updates.reconciliation_status = 'RECONCILED';

		// Recalculate sqft if dimensions changed
		const width = updates.width_in ?? line.width_in;
		const qty = updates.qty ?? line.qty;
		const length = updates.length_ft ?? line.length_ft;
		updates.sqft = calcSqft({ width_in: width, length_ft: length }, qty);

		const setClauses = Object.keys(updates)
			.map((k) => `${k} = ?`)
			.join(', ');
		await conn.query(`UPDATE work_order_lines SET ${setClauses} WHERE id = ?`, [
			...Object.values(updates),
			billingLineId,
		]);

		await conn.commit();

		const [[updated]] = await db.query('SELECT * FROM work_order_lines WHERE id = ?', [
			billingLineId,
		]);
		return updated;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function splitBillingLine(billingLineId, newLines, _userId) {
	const conn = await db.getConnection();
	try {
		await conn.beginTransaction();

		const [[original]] = await conn.query(
			'SELECT * FROM work_order_lines WHERE id = ? FOR UPDATE',
			[billingLineId]
		);
		if (!original) throw new Error('Billing line not found.');
		if (original.reconciliation_status !== 'STALE')
			throw new Error('Only STALE billing lines can be split.');

		const [children] = await conn.query(
			'SELECT * FROM work_order_lines WHERE parent_line_id = ?',
			[billingLineId]
		);

		if (!newLines || newLines.length < 2)
			throw new Error('Split requires at least two new billing lines.');

		const newIds = [];
		for (const nl of newLines) {
			const sqft = calcSqft(
				{
					width_in: nl.widthIn ?? original.width_in,
					length_ft: nl.lengthFt ?? original.length_ft,
				},
				nl.qty ?? original.qty
			);
			const [{ insertId }] = await conn.query(
				`INSERT INTO work_order_lines
				 (wo_id, parent_line_id, sku_id, thickness_in, width_in, qty, length_ft, sqft,
				  facing, rollfor, tab_type, instructions, rolls_produced, reconciliation_status, path_type)
				 VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECONCILED', NULL)`,
				[
					original.wo_id,
					nl.skuId ?? original.sku_id,
					original.thickness_in,
					nl.widthIn ?? original.width_in,
					nl.qty ?? original.qty,
					nl.lengthFt ?? original.length_ft,
					sqft,
					original.facing,
					original.rollfor,
					original.tab_type,
					original.instructions,
					0,
				]
			);
			newIds.push(insertId);
		}

		// Re-parent children to closest new billing line by width
		for (const child of children) {
			const bestParent = newIds.reduce(
				(best, id, idx) => {
					const nl = newLines[idx];
					const diff = Math.abs(
						(nl.widthIn ?? original.width_in) - Number(child.width_in)
					);
					return diff < best.diff ? { id, diff } : best;
				},
				{ id: newIds[0], diff: Infinity }
			);

			await conn.query('UPDATE work_order_lines SET parent_line_id = ? WHERE id = ?', [
				bestParent.id,
				child.id,
			]);
		}

		// Mark original superseded
		await conn.query(
			"UPDATE work_order_lines SET reconciliation_status = 'SUPERSEDED' WHERE id = ?",
			[billingLineId]
		);

		await conn.commit();
		return newIds;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export const __cutdownTest = {
	calcRawRollSqft,
	calcScheduledRawRolls,
};
