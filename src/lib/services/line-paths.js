const RAW_FACINGS = new Set(['RAW', 'UNFACED']);

export function deriveLineType(line) {
	if (line.parent_line_id !== null && line.parent_line_id !== undefined) return 'PRODUCTION';
	const childCount = Number(line.child_count ?? line.childCount ?? 0);
	return childCount > 0 ? 'BILLING' : 'UNBRANCHED';
}

export function isProductionLine(line) {
	return deriveLineType(line) === 'PRODUCTION';
}

export function isBillingLikeLine(line) {
	const lineType = deriveLineType(line);
	return lineType === 'BILLING' || lineType === 'UNBRANCHED';
}

export function hasRawFacing(line) {
	return RAW_FACINGS.has(
		String(line.facing ?? '')
			.trim()
			.toUpperCase()
	);
}

export function inferPathType(line) {
	const lineType = deriveLineType(line);
	if (lineType === 'BILLING') return null;

	if (lineType === 'PRODUCTION') {
		return hasRawFacing(line) ? 'CUT_SHIP' : 'CUT_LAMINATE';
	}

	return hasRawFacing(line) ? 'DIRECT_SHIP' : 'STANDARD';
}

export function canLineBlockWoCompletion(line) {
	return isBillingLikeLine(line) && line.reconciliation_status === 'STALE';
}

export function isLineProductionComplete(line) {
	const lineType = deriveLineType(line);
	if (lineType === 'BILLING') return true;
	return Number(line.rolls_produced) >= Number(line.qty);
}
