<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { shipment, availableRuns } = data;

	// Current lines — track which are kept and their roll counts
	let keepLines = $state(new Set(shipment.lines.map((l) => l.id)));
	let lineRolls = $state(new Map(shipment.lines.map((l) => [l.id, l.rolls])));
	function setLineRolls(id, val) {
		const next = new Map(lineRolls);
		next.set(id, val);
		lineRolls = next;
	}

	// Available runs to add
	let addSelected = $state(new Set());
	let addRolls = $state(new Map(availableRuns.map((r) => [r.id, r.rolls_actual])));
	function setAddRolls(id, val) {
		const next = new Map(addRolls);
		next.set(id, val);
		addRolls = next;
	}
	function toggleAdd(id) {
		const next = new Set(addSelected);
		next.has(id) ? next.delete(id) : next.add(id);
		addSelected = next;
	}

	const allRuns = $derived([
		...shipment.lines.map((l) => ({ ...l, _type: 'line', rolls_actual: l.rolls })),
		...availableRuns.map((r) => ({ ...r, _type: 'run' })),
	]);

	const totalRolls = $derived(
		shipment.lines
			.filter((l) => keepLines.has(l.id))
			.reduce((s, l) => s + (lineRolls.get(l.id) ?? l.rolls), 0) +
			availableRuns
				.filter((r) => addSelected.has(r.id))
				.reduce((s, r) => s + (addRolls.get(r.id) ?? r.rolls_actual), 0)
	);
	const totalSqft = $derived(
		shipment.lines
			.filter((l) => keepLines.has(l.id))
			.reduce((s, l) => {
				const rolls = lineRolls.get(l.id) ?? l.rolls;
				return s + Math.round((rolls / l.rolls) * l.sqft);
			}, 0) +
			availableRuns
				.filter((r) => addSelected.has(r.id))
				.reduce((s, r) => {
					const rolls = addRolls.get(r.id) ?? r.rolls_actual;
					return s + Math.round((rolls / r.rolls_actual) * r.sqft_actual);
				}, 0)
	);
</script>

<svelte:head><title>Edit {shipment.shipment_number} — PandS</title></svelte:head>

<div class="p-6 max-w-5xl">
	<div class="flex items-center gap-4 mb-6">
		<a href="/shipments/{shipment.id}" class="text-gray-400 hover:text-gray-600 text-sm"
			>← {shipment.shipment_number}</a
		>
		<h1 class="text-xl font-semibold text-gray-900">Edit Shipment</h1>
	</div>

	<form method="POST" use:enhance class="space-y-6">
		{#if form?.error}
			<p class="text-red-600 text-sm">{form.error}</p>
		{/if}

		<div class="card card-body space-y-3">
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<p class="form-label">Customer</p>
					<p class="text-gray-900">{shipment.customer_name}</p>
				</div>
				<div>
					<p class="form-label">Job</p>
					<p class="text-gray-900">{shipment.job_name}</p>
				</div>
			</div>
			<div>
				<label for="ship_date" class="form-label">Ship Date</label>
				<input
					id="ship_date"
					name="ship_date"
					type="date"
					class="form-input w-48"
					value={shipment.ship_date
						? new Date(shipment.ship_date).toISOString().slice(0, 10)
						: ''}
				/>
			</div>
		</div>

		<div class="card">
			<div class="card-header flex items-center justify-between">
				<span class="font-semibold text-sm text-gray-700">Production Runs</span>
				{#if totalRolls > 0}
					<span class="text-sm text-gray-500"
						>{totalRolls} rolls · {fmtSqft(totalSqft)} sq ft selected</span
					>
				{/if}
			</div>
			{#if allRuns.length === 0}
				<div class="card-body text-sm text-gray-500">
					No runs available for this shipment.
				</div>
			{:else}
				<table class="min-w-full divide-y divide-gray-200 text-sm">
					<thead class="bg-gray-50">
						<tr>
							<th class="w-8 px-4 py-3"></th>
							<th class="px-4 py-3 text-left font-medium text-gray-500">Roll For</th>
							<th class="px-4 py-3 text-left font-medium text-gray-500">Facing</th>
							<th class="px-4 py-3 text-right font-medium text-gray-500">Ship</th>
							<th class="px-4 py-3 text-right font-medium text-gray-500">Thickness</th
							>
							<th class="px-4 py-3 text-right font-medium text-gray-500">Width</th>
							<th class="px-4 py-3 text-right font-medium text-gray-500">Length</th>
							<th class="px-4 py-3 text-right font-medium text-gray-500"
								>Sq Ft/Roll</th
							>
							<th class="px-4 py-3 text-right font-medium text-gray-500"
								>Total Sq Ft</th
							>
							<th class="px-4 py-3 text-left font-medium text-gray-500">Run Date</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 bg-white">
						{#each shipment.lines as line (line.id)}
							{@const kept = keepLines.has(line.id)}
							<tr
								class="cursor-pointer {kept
									? 'bg-blue-50 hover:bg-blue-100'
									: 'opacity-40 hover:opacity-60'}"
								onclick={() => {
									const next = new Set(keepLines);
									next.has(line.id) ? next.delete(line.id) : next.add(line.id);
									keepLines = next;
								}}
							>
								<td class="px-4 py-3">
									{#if !kept}
										<input type="hidden" name="remove_line" value={line.id} />
									{/if}
									<input
										type="checkbox"
										checked={kept}
										onchange={() => {
											const next = new Set(keepLines);
											next.has(line.id)
												? next.delete(line.id)
												: next.add(line.id);
											keepLines = next;
										}}
										onclick={(e) => e.stopPropagation()}
									/>
								</td>
								<td class="px-4 py-3 text-gray-600">{line.rollfor ?? ''}</td>
								<td class="px-4 py-3 text-gray-600">{line.facing ?? ''}</td>
								<td class="px-2 py-2" onclick={(e) => e.stopPropagation()}>
									<input
										type="number"
										name="line_rolls_{line.id}"
										min="1"
										max={line.rolls}
										value={lineRolls.get(line.id)}
										oninput={(e) =>
											setLineRolls(line.id, parseInt(e.target.value) || 1)}
										disabled={!kept}
										class="form-input w-16 text-right tabular-nums text-sm py-1"
									/>
								</td>
								<td class="px-4 py-3 text-right tabular-nums text-gray-600"
									>{line.thickness_in ?? ''}"</td
								>
								<td class="px-4 py-3 text-right tabular-nums text-gray-600"
									>{line.width_in ?? ''}"</td
								>
								<td class="px-4 py-3 text-right tabular-nums text-gray-600"
									>{line.length_ft ?? ''} ft</td
								>
								<td
									class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
									>{fmtSqft(Math.round(line.sqft / line.rolls))}</td
								>
								<td
									class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
									>{fmtSqft(
										Math.round(
											((lineRolls.get(line.id) ?? line.rolls) / line.rolls) *
												line.sqft
										)
									)}</td
								>
								<td class="px-4 py-3 text-gray-600"
									>{line.run_date ? fmtDate(line.run_date) : '—'}</td
								>
							</tr>
						{/each}
						{#each availableRuns as run (run.id)}
							{@const sel = addSelected.has(run.id)}
							<tr
								class="cursor-pointer {sel
									? 'bg-blue-50 hover:bg-blue-100'
									: 'hover:bg-gray-50'}"
								onclick={() => toggleAdd(run.id)}
							>
								<td class="px-4 py-3">
									<input
										type="checkbox"
										name="add_run_ids"
										value={run.id}
										checked={sel}
										onchange={() => toggleAdd(run.id)}
										onclick={(e) => e.stopPropagation()}
									/>
								</td>
								<td class="px-4 py-3 text-gray-600">{run.rollfor}</td>
								<td class="px-4 py-3 text-gray-600">{run.facing}</td>
								<td class="px-2 py-2" onclick={(e) => e.stopPropagation()}>
									<input
										type="number"
										name="add_rolls_{run.id}"
										min="1"
										max={run.rolls_actual}
										value={addRolls.get(run.id)}
										oninput={(e) =>
											setAddRolls(run.id, parseInt(e.target.value) || 1)}
										class="form-input w-16 text-right tabular-nums text-sm py-1"
									/>
								</td>
								<td class="px-4 py-3 text-right tabular-nums text-gray-600"
									>{run.thickness_in}"</td
								>
								<td class="px-4 py-3 text-right tabular-nums text-gray-600"
									>{run.width_in}"</td
								>
								<td class="px-4 py-3 text-right tabular-nums text-gray-600"
									>{run.length_ft} ft</td
								>
								<td
									class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
									>{fmtSqft(Math.round(run.sqft_actual / run.rolls_actual))}</td
								>
								<td
									class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
									>{fmtSqft(
										Math.round(
											((addRolls.get(run.id) ?? run.rolls_actual) /
												run.rolls_actual) *
												run.sqft_actual
										)
									)}</td
								>
								<td class="px-4 py-3 text-gray-600"
									>{run.run_date ? fmtDate(run.run_date) : '—'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Save Changes</button>
			<a href="/shipments/{shipment.id}" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
