<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wo, cutDown, wipPreview } = $derived(data);

	let showUnconfirmWarning = $state(false);
</script>

<svelte:head><title>Confirm Cut-Down — WO {wo.so_number} — PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center gap-4">
	<a href="/wo/{wo.id}/cutdown" class="text-gray-400 hover:text-gray-600 text-sm">← Cut-Downs</a>
	<h1 class="text-lg font-semibold text-gray-900">Confirm Cut-Down</h1>
	<span
		class="badge-{cutDown.status === 'COMPLETED'
			? 'green'
			: cutDown.status === 'SCHEDULED'
				? 'blue'
				: 'gray'}">{cutDown.status}</span
	>
</header>

<main class="p-6 max-w-2xl space-y-4">
	{#if form?.error}
		<div class="px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
			{form.error}
		</div>
	{/if}

	<!-- Cut-down summary -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Cut-Down Details</span>
		</div>
		<div class="card-body grid grid-cols-3 gap-4 text-sm">
			<div>
				<p class="form-label">SKU</p>
				<p class="text-gray-900">{cutDown.sku_label}</p>
			</div>
			<div>
				<p class="form-label">Rolls Scheduled</p>
				<p class="text-gray-900 tabular-nums">{cutDown.rolls_scheduled}</p>
			</div>
			<div>
				<p class="form-label">Sqft Scheduled</p>
				<p class="text-gray-900 font-mono">{fmtSqft(cutDown.sqft_scheduled)}</p>
			</div>
			<div>
				<p class="form-label">Run Date</p>
				<p class="text-gray-900">{cutDown.run_date ? fmtDate(cutDown.run_date) : '—'}</p>
			</div>
			{#if cutDown.status === 'COMPLETED'}
				<div>
					<p class="form-label">Confirmed</p>
					<p class="text-gray-900">{fmtDate(cutDown.confirmed_at)}</p>
				</div>
				<div>
					<p class="form-label">Rolls Actual</p>
					<p class="text-gray-900 tabular-nums">{cutDown.rolls_actual}</p>
				</div>
				<div>
					<p class="form-label">Sqft Actual</p>
					<p class="text-gray-900 font-mono">{fmtSqft(cutDown.sqft_actual)}</p>
				</div>
				{#if cutDown.waste_sqft_actual}<div>
						<p class="form-label">Waste</p>
						<p class="text-gray-900 font-mono">{fmtSqft(cutDown.waste_sqft_actual)}</p>
					</div>{/if}
				<div>
					<p class="form-label">Scrap</p>
					<p class="text-gray-900">{cutDown.scrap_disposition ?? '—'}</p>
				</div>
				{#if cutDown.operator_notes}<div class="col-span-3">
						<p class="form-label">Notes</p>
						<p class="text-gray-600 italic text-xs">{cutDown.operator_notes}</p>
					</div>{/if}
			{/if}
		</div>
	</div>

	<!-- WIP preview -->
	{#if wipPreview.length > 0}
		<div class="card">
			<div class="card-header">
				<span class="font-semibold text-sm text-gray-700"
					>WIP CUT_IN Preview (on confirm)</span
				>
			</div>
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50">
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Width</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Est. Sqft</th>
					</tr>
				</thead>
				<tbody>
					{#each wipPreview as pl (pl.id)}
						<tr class="border-b border-gray-100 last:border-0">
							<td class="px-4 py-2 text-right font-mono">{pl.width_in}"</td>
							<td class="px-4 py-2 text-right font-mono"
								>{fmtSqft(pl.estimatedSqft)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if cutDown.status !== 'COMPLETED'}
		<!-- Confirmation form -->
		<div class="card">
			<div class="card-header">
				<span class="font-semibold text-sm text-gray-700">Confirm</span>
			</div>
			<form
				method="POST"
				action="?/confirmCutDown"
				use:enhance
				class="card-body space-y-4 text-sm"
			>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="rollsActual" class="form-label">Rolls Actual *</label>
						<input
							id="rollsActual"
							name="rollsActual"
							type="number"
							min="1"
							max={cutDown.rolls_scheduled}
							class="form-input w-20"
							required
						/>
					</div>
					<div>
						<label for="sqftActual" class="form-label"
							>Sqft Actual <span class="text-gray-400">(auto if blank)</span></label
						>
						<input
							id="sqftActual"
							name="sqftActual"
							type="number"
							min="0"
							class="form-input w-32"
						/>
					</div>
					<div>
						<label for="wasteActual" class="form-label">Waste Sqft</label>
						<input
							id="wasteActual"
							name="wasteActual"
							type="number"
							min="0"
							class="form-input w-32"
						/>
					</div>
				</div>

				<div>
					<p class="form-label">Scrap Disposition *</p>
					<div class="flex flex-col gap-2 mt-1">
						{#each [['SAVED', 'Save in-house (stays in WIP ledger)'], ['DISCARDED', 'Discard (written off immediately)'], ['DELIVERED', 'Deliver with order (noted on shipment)']] as [val, label] (val)}
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="radio" name="scrapDisposition" value={val} required />
								<span>{label}</span>
							</label>
						{/each}
					</div>
				</div>

				<div>
					<label for="operatorNotes" class="form-label">Operator Notes</label>
					<textarea id="operatorNotes" name="operatorNotes" rows="2" class="form-input"
					></textarea>
				</div>

				<button type="submit" class="btn-primary">Confirm Cut-Down</button>
			</form>
		</div>
	{:else}
		<!-- Unconfirm -->
		<div class="card card-body">
			{#if form?.warnings}
				<div
					class="mb-4 px-4 py-3 rounded-md text-sm bg-amber-50 text-amber-800 border border-amber-200 space-y-1"
				>
					<p class="font-medium">Warning — downstream records exist:</p>
					{#if form.warnings.runNumbers.length > 0}
						<p>
							Runs that will lose WIP material: {form.warnings.runNumbers.join(', ')}
						</p>
					{/if}
					{#if form.warnings.shipmentNumbers.length > 0}
						<p>
							Shipments referencing this cut-down: {form.warnings.shipmentNumbers.join(
								', '
							)}
						</p>
					{/if}
					<form method="POST" action="?/unconfirmCutDown" use:enhance class="mt-3">
						<button type="submit" class="btn-danger btn-sm">Confirm Unconfirm</button>
					</form>
				</div>
			{:else}
				<form method="POST" action="?/unconfirmCutDown" use:enhance>
					<button
						type="button"
						class="btn-danger btn-sm"
						onclick={() => (showUnconfirmWarning = !showUnconfirmWarning)}
					>
						Unconfirm Cut-Down
					</button>
					{#if showUnconfirmWarning}
						<div
							class="mt-3 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 space-y-2"
						>
							<p>
								This will reverse the inventory CONSUMPTION and clear WIP entries.
								Any downstream production runs or shipments will be flagged in a
								warning.
							</p>
							<button type="submit" class="btn-danger btn-sm">Yes, unconfirm</button>
							<button
								type="button"
								class="btn-secondary btn-sm ml-2"
								onclick={() => (showUnconfirmWarning = false)}>Cancel</button
							>
						</div>
					{/if}
				</form>
			{/if}
		</div>
	{/if}
</main>
