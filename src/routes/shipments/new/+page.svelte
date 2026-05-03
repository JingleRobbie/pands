<script>
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const wo = $derived(data.wo);
	const runs = $derived(data.runs);

	let selected = new SvelteSet();
	const toggle = (id) => {
		selected.has(id) ? selected.delete(id) : selected.add(id);
	};
	const allSelected = $derived(runs.length > 0 && selected.size === runs.length);
	const someSelected = $derived(selected.size > 0 && !allSelected);
	function toggleAll() {
		selected.clear();
		if (!allSelected) {
			for (const run of runs) selected.add(run.id);
		}
	}
	let masterSelectCb = $state(null);
	$effect(() => {
		if (masterSelectCb) masterSelectCb.indeterminate = someSelected;
	});

	let rollsToShip = new SvelteMap(untrack(() => runs.map((r) => [r.id, r.rolls_actual])));
	function setRolls(id, val) {
		rollsToShip.set(id, val);
	}

	const totalRolls = $derived(
		runs
			.filter((r) => selected.has(r.id))
			.reduce((s, r) => s + (rollsToShip.get(r.id) ?? r.rolls_actual), 0)
	);
	const totalSqft = $derived(
		runs
			.filter((r) => selected.has(r.id))
			.reduce((s, r) => {
				const rolls = rollsToShip.get(r.id) ?? r.rolls_actual;
				return s + Math.round((rolls / r.rolls_actual) * r.sqft_actual);
			}, 0)
	);
</script>

<div class="p-6 max-w-3xl">
	<div class="flex items-center gap-4 mb-6">
		<a href="/wo/{wo.id}" class="text-gray-400 hover:text-gray-600 text-sm"
			>← WO #{wo.so_number}</a
		>
		<h1 class="text-xl font-semibold text-gray-900">New Shipment</h1>
	</div>

	<form method="POST" use:enhance class="space-y-6">
		{#if form?.error}
			<p class="text-red-600 text-sm">{form.error}</p>
		{/if}

		<input type="hidden" name="wo_id" value={wo.id} />
		<input type="hidden" name="customer_id" value={wo.customer_id} />

		<div class="card card-body space-y-3">
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<p class="form-label">Customer</p>
					<p class="text-gray-900">{wo.customer_display_name}</p>
				</div>
				<div>
					<p class="form-label">Job</p>
					<p class="text-gray-900">{wo.job_name}</p>
				</div>
			</div>
			<div>
				<label for="ship_date" class="form-label">Ship Date *</label>
				<input
					id="ship_date"
					name="ship_date"
					type="date"
					class="form-input w-48"
					required
				/>
			</div>
		</div>

		<div class="card">
			<div class="card-header flex items-center justify-between">
				<span class="font-semibold text-sm text-gray-700">Select Production Runs</span>
				{#if selected.size > 0}
					<span class="text-sm text-gray-500"
						>{totalRolls} rolls · {fmtSqft(totalSqft)} sq ft selected</span
					>
				{/if}
			</div>
			{#if runs.length === 0}
				<div class="card-body text-sm text-gray-500">
					No completed, unshipped runs for this work order.
				</div>
			{:else}
				<table class="min-w-full divide-y divide-gray-200 text-sm">
					<thead class="bg-gray-50">
						<tr>
							<th class="w-8 px-4 py-3">
								<input
									type="checkbox"
									bind:this={masterSelectCb}
									checked={allSelected}
									onchange={toggleAll}
								/>
							</th>
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
						{#each runs as run (run.id)}
							<tr
								class="cursor-pointer hover:bg-blue-50 {selected.has(run.id)
									? 'bg-blue-50'
									: ''}"
								onclick={() => toggle(run.id)}
							>
								<td class="px-4 py-3">
									<input
										type="checkbox"
										name="run_ids"
										value={run.id}
										checked={selected.has(run.id)}
										onchange={() => toggle(run.id)}
										onclick={(e) => e.stopPropagation()}
									/>
								</td>
								<td class="px-4 py-3 text-gray-600">{run.rollfor}</td>
								<td class="px-4 py-3 text-gray-600">{run.facing}</td>
								<td class="px-2 py-2" onclick={(e) => e.stopPropagation()}>
									<div class="flex justify-end">
										<input
											type="number"
											name="rolls_to_ship_{run.id}"
											min="1"
											max={run.rolls_actual}
											value={rollsToShip.get(run.id)}
											oninput={(e) =>
												setRolls(run.id, parseInt(e.target.value) || 1)}
											class="form-input w-16 text-right tabular-nums text-sm py-1"
										/>
									</div>
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
											((rollsToShip.get(run.id) ?? run.rolls_actual) /
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
			<button type="submit" class="btn-primary" disabled={selected.size === 0}>
				Create Shipment
			</button>
			<a href="/wo/{wo.id}" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
