import { db } from '$lib/db.js';
import { error, fail, redirect } from '@sveltejs/kit';

export async function load({ params }) {
	const [[run]] = await db.query(
		`SELECT pr.*, ms.display_label, so.so_number, so.job_name, sol.sqft_ordered, sol.sqft_produced
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.id = ?`,
		[params.id]
	);
	if (!run) error(404, 'Production run not found');
	if (run.status === 'COMPLETED') error(400, 'Completed runs cannot be edited');

	// Max sqft = unscheduled sqft for the SO line + this run's current sqft_scheduled
	const [[{ otherScheduled }]] = await db.query(
		`SELECT COALESCE(SUM(sqft_scheduled), 0) AS otherScheduled
		 FROM production_runs
		 WHERE so_line_id = ? AND id != ? AND status != 'COMPLETED'`,
		[run.so_line_id, params.id]
	);
	const maxSqft = Number(run.sqft_ordered) - Number(run.sqft_produced) - Number(otherScheduled);

	// Load peer runs in the same group (excluding this run and completed runs)
	let peers = [];
	if (run.group_id) {
		const [peerRows] = await db.query(
			`SELECT pr.*, ms.display_label, sol.sqft_ordered, sol.sqft_produced
			 FROM production_runs pr
			 JOIN material_skus ms ON ms.id = pr.sku_id
			 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
			 WHERE pr.group_id = ? AND pr.id != ? AND pr.status != 'COMPLETED'
			 ORDER BY ms.sort_order`,
			[run.group_id, params.id]
		);

		peers = await Promise.all(
			peerRows.map(async (peer) => {
				const [[{ otherSched }]] = await db.query(
					`SELECT COALESCE(SUM(sqft_scheduled), 0) AS otherSched
					 FROM production_runs
					 WHERE so_line_id = ? AND id != ? AND status != 'COMPLETED'`,
					[peer.so_line_id, peer.id]
				);
				const maxSqft =
					Number(peer.sqft_ordered) - Number(peer.sqft_produced) - Number(otherSched);
				return { ...peer, maxSqft };
			})
		);
	}

	return { run, maxSqft, peers };
}

export const actions = {
	default: async ({ request, params, locals }) => {
		const data = await request.formData();
		const runDate = data.get('run_date')?.trim() || null;
		const sqftScheduled = Math.round(Number(data.get('sqft_scheduled')));
		const peerIds = data.getAll('peer_id').map(Number);

		if (isNaN(sqftScheduled) || sqftScheduled < 1)
			return fail(400, { error: 'Scheduled sq ft must be at least 1.' });

		const conn = await db.getConnection();
		try {
			await conn.beginTransaction();

			// Lock and validate primary run
			const [[run]] = await conn.query(
				'SELECT * FROM production_runs WHERE id = ? FOR UPDATE',
				[params.id]
			);
			if (!run) return fail(404, { error: 'Run not found.' });
			if (run.status === 'COMPLETED')
				return fail(400, { error: 'Completed runs cannot be edited.' });

			const [[sol]] = await conn.query('SELECT * FROM sales_order_lines WHERE id = ?', [
				run.so_line_id,
			]);
			const [[{ otherScheduled }]] = await conn.query(
				`SELECT COALESCE(SUM(sqft_scheduled), 0) AS otherScheduled
				 FROM production_runs
				 WHERE so_line_id = ? AND id != ? AND status != 'COMPLETED'`,
				[run.so_line_id, params.id]
			);
			const maxSqft =
				Number(sol.sqft_ordered) - Number(sol.sqft_produced) - Number(otherScheduled);

			if (sqftScheduled > maxSqft)
				return fail(400, {
					error: `Cannot schedule ${sqftScheduled} sqft — only ${maxSqft} sqft available.`,
				});

			const newStatus = runDate ? 'SCHEDULED' : 'UNSCHEDULED';
			await conn.query(
				'UPDATE production_runs SET run_date = ?, sqft_scheduled = ?, status = ? WHERE id = ?',
				[runDate, sqftScheduled, newStatus, params.id]
			);

			// Apply date (and optional sqft) to checked peer runs
			for (const peerId of peerIds) {
				const [[peer]] = await conn.query(
					'SELECT * FROM production_runs WHERE id = ? FOR UPDATE',
					[peerId]
				);
				if (!peer || peer.status === 'COMPLETED') continue;

				const peerSqft = Math.round(Number(data.get(`peer_sqft_${peerId}`)));

				if (!isNaN(peerSqft) && peerSqft >= 1) {
					// Validate peer sqft against its own SO line
					const [[peerSol]] = await conn.query(
						'SELECT * FROM sales_order_lines WHERE id = ?',
						[peer.so_line_id]
					);
					const [[{ peerOtherSched }]] = await conn.query(
						`SELECT COALESCE(SUM(sqft_scheduled), 0) AS peerOtherSched
						 FROM production_runs
						 WHERE so_line_id = ? AND id != ? AND status != 'COMPLETED'`,
						[peer.so_line_id, peerId]
					);
					const peerMax =
						Number(peerSol.sqft_ordered) -
						Number(peerSol.sqft_produced) -
						Number(peerOtherSched);

					if (peerSqft > peerMax)
						return fail(400, {
							error: `Cannot schedule ${peerSqft} sqft for ${peer.run_number} — only ${peerMax} sqft available.`,
						});

					await conn.query(
						'UPDATE production_runs SET run_date = ?, sqft_scheduled = ?, status = ? WHERE id = ?',
						[runDate, peerSqft, newStatus, peerId]
					);
				} else {
					// Only update the date
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

		redirect(303, `/production/${params.id}/confirm`);
	},
};
