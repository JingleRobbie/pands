import { db } from '$lib/db.js';
import { safeReturnTo, withReturnTo } from '$lib/navigation.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params }) {
	const [[run]] = await db.query(
		`SELECT pr.*, ms.display_label, wol.facing, wol.qty, wol.rolls_produced, wol.width_in, wol.length_ft,
		        wo.so_number, wo.job_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
		 JOIN work_orders wo ON wo.id = wol.wo_id
		 WHERE pr.id = ?`,
		[params.id]
	);
	if (!run) error(404, 'Production run not found');
	if (run.status === 'COMPLETED') error(400, 'Completed runs cannot be edited');

	const [[{ otherScheduled }]] = await db.query(
		`SELECT COALESCE(SUM(rolls_scheduled), 0) AS otherScheduled
		 FROM production_runs
		 WHERE wo_line_id = ? AND id != ? AND status != 'COMPLETED'`,
		[run.wo_line_id, params.id]
	);
	const maxRolls = Number(run.qty) - Number(run.rolls_produced) - Number(otherScheduled);

	let peers = [];
	if (run.group_id) {
		const [peerRows] = await db.query(
			`SELECT pr.*, ms.display_label, wol.qty, wol.rolls_produced
			 FROM production_runs pr
			 JOIN material_skus ms ON ms.id = pr.sku_id
			 JOIN work_order_lines wol ON wol.id = pr.wo_line_id
			 WHERE pr.group_id = ? AND pr.id != ? AND pr.status != 'COMPLETED'
			 ORDER BY ms.sort_order`,
			[run.group_id, params.id]
		);

		peers = await Promise.all(
			peerRows.map(async (peer) => {
				const [[{ otherSched }]] = await db.query(
					`SELECT COALESCE(SUM(rolls_scheduled), 0) AS otherSched
					 FROM production_runs
					 WHERE wo_line_id = ? AND id != ? AND status != 'COMPLETED'`,
					[peer.wo_line_id, peer.id]
				);
				const maxRolls =
					Number(peer.qty) - Number(peer.rolls_produced) - Number(otherSched);
				return { ...peer, maxRolls };
			})
		);
	}

	return { run, maxRolls, peers };
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const returnTo = safeReturnTo(data.get('return_to'), '/production');
		const runDate = data.get('run_date')?.trim() || null;
		const rollsScheduled = parseInt(data.get('rolls_scheduled'));
		const peerIds = data.getAll('peer_id').map(Number);

		if (isNaN(rollsScheduled) || rollsScheduled < 1)
			return fail(400, { error: 'Rolls scheduled must be at least 1.' });

		const conn = await db.getConnection();
		try {
			await conn.beginTransaction();

			const [[run]] = await conn.query(
				'SELECT * FROM production_runs WHERE id = ? FOR UPDATE',
				[params.id]
			);
			if (!run) return fail(404, { error: 'Run not found.' });
			if (run.status === 'COMPLETED')
				return fail(400, { error: 'Completed runs cannot be edited.' });

			const [[wol]] = await conn.query('SELECT * FROM work_order_lines WHERE id = ?', [
				run.wo_line_id,
			]);
			const [[{ otherScheduled }]] = await conn.query(
				`SELECT COALESCE(SUM(rolls_scheduled), 0) AS otherScheduled
				 FROM production_runs
				 WHERE wo_line_id = ? AND id != ? AND status != 'COMPLETED'`,
				[run.wo_line_id, params.id]
			);
			const maxRolls = Number(wol.qty) - Number(wol.rolls_produced) - Number(otherScheduled);

			if (rollsScheduled > maxRolls)
				return fail(400, {
					error: `Cannot schedule ${rollsScheduled} rolls — only ${maxRolls} rolls available.`,
				});

			const sqftScheduled = Math.round(
				rollsScheduled * (Number(wol.width_in) / 12) * Number(wol.length_ft)
			);
			const newStatus = runDate ? 'SCHEDULED' : 'UNSCHEDULED';
			await conn.query(
				'UPDATE production_runs SET run_date = ?, rolls_scheduled = ?, sqft_scheduled = ?, status = ? WHERE id = ?',
				[runDate, rollsScheduled, sqftScheduled, newStatus, params.id]
			);

			for (const peerId of peerIds) {
				const [[peer]] = await conn.query(
					'SELECT * FROM production_runs WHERE id = ? FOR UPDATE',
					[peerId]
				);
				if (!peer || peer.status === 'COMPLETED') continue;

				const peerRolls = parseInt(data.get(`peer_rolls_${peerId}`));
				const [[peerWol]] = await conn.query(
					'SELECT * FROM work_order_lines WHERE id = ?',
					[peer.wo_line_id]
				);
				const [[{ peerOtherSched }]] = await conn.query(
					`SELECT COALESCE(SUM(rolls_scheduled), 0) AS peerOtherSched
					 FROM production_runs
					 WHERE wo_line_id = ? AND id != ? AND status != 'COMPLETED'`,
					[peer.wo_line_id, peerId]
				);
				const peerMax =
					Number(peerWol.qty) - Number(peerWol.rolls_produced) - Number(peerOtherSched);

				if (!isNaN(peerRolls) && peerRolls >= 1) {
					if (peerRolls > peerMax)
						return fail(400, {
							error: `Cannot schedule ${peerRolls} rolls for ${peer.run_number} — only ${peerMax} available.`,
						});
					const peerSqft = Math.round(
						peerRolls * (Number(peerWol.width_in) / 12) * Number(peerWol.length_ft)
					);
					await conn.query(
						'UPDATE production_runs SET run_date = ?, rolls_scheduled = ?, sqft_scheduled = ?, status = ? WHERE id = ?',
						[runDate, peerRolls, peerSqft, newStatus, peerId]
					);
				} else {
					await conn.query(
						'UPDATE production_runs SET run_date = ?, status = ? WHERE id = ?',
						[runDate, newStatus, peerId]
					);
				}
			}

			await conn.commit();
		} catch (err) {
			await conn.rollback();
			return fail(500, { error: err.message });
		} finally {
			conn.release();
		}

		redirect(303, withReturnTo(`/production/${params.id}/confirm`, returnTo));
	},
};
