<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getReturnTo, withReturnTo } from '$lib/navigation.js';
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const shipment = $derived(data.shipment);
	const returnTo = $derived(getReturnTo(page.url, '/shipments'));
	const shipmentHref = $derived(withReturnTo(`/shipments/${shipment.id}`, returnTo));

	let lineRolls = new SvelteMap(untrack(() => shipment.lines.map((l) => [l.id, l.rolls])));
	let confirmDialog = $state(null);
	const anyInvalid = $derived(
		shipment.lines.some((l) => {
			const val = lineRolls.get(l.id) ?? l.rolls;
			return val < 1 || val > l.rolls;
		})
	);
	function openConfirm() {
		if (anyInvalid) return;
		confirmDialog.showModal();
	}
	function setLineRolls(id, val) {
		lineRolls.set(id, val);
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
		<a href={shipmentHref} class="text-gray-400 hover:text-gray-600 text-sm"
			>← {shipment.shipment_number}</a
		>
		<h1 class="text-xl font-semibold text-gray-900">Mark Shipped</h1>
		<span class="badge-amber">{shipment.status}</span>
	</div>

	<form
		method="POST"
		use:enhance={() =>
			({ update }) => {
				confirmDialog?.close();
				return update();
			}}
		class="space-y-6"
	>
		<input type="hidden" name="return_to" value={returnTo} />
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
								<div class="flex justify-end">
									<input
										type="number"
										name="line_rolls_{line.id}"
										min="1"
										max={line.rolls}
										value={lineRolls.get(line.id)}
										oninput={(e) =>
											setLineRolls(
												line.id,
												Math.max(0, parseInt(e.target.value) || 0)
											)}
										class="form-input w-16 text-right tabular-nums text-sm py-1"
									/>
								</div>
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

		{#if anyInvalid}
			<div
				class="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800"
			>
				One or more lines has an invalid roll count (must be between 1 and the line
				maximum). To remove a line entirely, go back and
				<a href={withReturnTo(`/shipments/${shipment.id}/edit`, returnTo)} class="underline font-medium"
					>edit the shipment</a
				>
				to remove that line before marking as shipped.
			</div>
		{/if}

		<div class="flex gap-3">
			<button type="button" class="btn-primary" onclick={openConfirm} disabled={anyInvalid}
				>Confirm &amp; Mark Shipped</button
			>
			<a href={shipmentHref} class="btn-secondary">Cancel</a>
		</div>

		<dialog
			bind:this={confirmDialog}
			class="rounded-lg shadow-xl p-6 w-96 backdrop:bg-black/30"
		>
			<p class="text-sm font-medium text-gray-900 mb-1">Mark shipment as SHIPPED?</p>
			<p class="text-xs text-gray-500 mb-4">
				{totalRolls} rolls · {fmtSqft(totalSqft)} sq ft will be committed. This deducts inventory
				and cannot be undone.
			</p>
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					class="btn-secondary btn-sm"
					onclick={() => confirmDialog.close()}>Cancel</button
				>
				<button type="submit" class="btn-primary btn-sm">Confirm</button>
			</div>
		</dialog>
	</form>
</div>

