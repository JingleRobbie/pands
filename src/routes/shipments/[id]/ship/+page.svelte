<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { shipment } = data;

	let lineRolls = $state(new Map(shipment.lines.map((l) => [l.id, l.rolls])));
	function setLineRolls(id, val) {
		const next = new Map(lineRolls);
		next.set(id, val);
		lineRolls = next;
	}

	const totalRolls = $derived(
		shipment.lines.reduce((s, l) => s + (lineRolls.get(l.id) ?? l.rolls), 0)
	);
	const totalSqft = $derived(
		shipment.lines.reduce((s, l) => {
			const rolls = lineRolls.get(l.id) ?? l.rolls;
			return s + Math.round((rolls / l.rolls) * l.sqft);
		}, 0)
	);
</script>

<svelte:head><title>Confirm {shipment.shipment_number} — PandS</title></svelte:head>

<div class="p-6 max-w-5xl">
	<div class="flex items-center gap-4 mb-6">
		<a href="/shipments/{shipment.id}" class="text-gray-400 hover:text-gray-600 text-sm"
			>← {shipment.shipment_number}</a
		>
		<h1 class="text-xl font-semibold text-gray-900">Mark Shipped</h1>
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
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<p class="form-label">Shipment #</p>
					<p class="text-gray-900 font-mono">{shipment.shipment_number}</p>
				</div>
				<div>
					<p class="form-label">Ship Date</p>
					<p class="text-gray-900">{fmtDate(shipment.ship_date)}</p>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header flex items-center justify-between">
				<span class="font-semibold text-sm text-gray-700">Rolls Being Shipped</span>
				<span class="text-sm text-gray-500"
					>{totalRolls} rolls · {fmtSqft(totalSqft)} sq ft</span
				>
			</div>
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Roll For</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Facing</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Ship</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Thickness</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Width</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Length</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Sq Ft/Roll</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Total Sq Ft</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Run Date</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each shipment.lines as line (line.id)}
						<tr class="bg-blue-50">
							<td class="px-4 py-3 text-gray-600">{line.rollfor ?? ''}</td>
							<td class="px-4 py-3 text-gray-600">{line.facing ?? ''}</td>
							<td class="px-2 py-2">
								<input
									type="number"
									name="line_rolls_{line.id}"
									min="1"
									max={line.rolls}
									value={lineRolls.get(line.id)}
									oninput={(e) =>
										setLineRolls(line.id, parseInt(e.target.value) || 1)}
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
							<td class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
								>{fmtSqft(Math.round(line.sqft / line.rolls))}</td
							>
							<td class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
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
				</tbody>
			</table>
		</div>

		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Confirm &amp; Mark Shipped</button>
			<a href="/shipments/{shipment.id}" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
