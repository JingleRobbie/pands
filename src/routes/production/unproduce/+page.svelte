<script>
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	import { untrack } from 'svelte';

	let { data, form } = $props();
	const eligibleRuns = $derived(data.eligibleRuns);
	let selectedDate = $state(untrack(() => data.selectedDate ?? ''));

	let unproduceDialog = $state(null);
	let pendingForm = $state(null);
	let pendingRun = $state(null);
	let pendingRolls = $state(0);
	let allowSubmit = $state(false);

	function applyDateFilter() {
		goto(selectedDate ? `/production/unproduce?date=${selectedDate}` : '/production/unproduce');
	}

	function requestUnproduce(formElement, run) {
		if (!formElement.reportValidity()) return;
		pendingForm = formElement;
		pendingRun = run;
		pendingRolls = Number(new FormData(formElement).get('rolls_to_unproduce'));
		unproduceDialog.showModal();
	}

	function handleSubmit(event, run) {
		if (!allowSubmit) {
			event.preventDefault();
			requestUnproduce(event.currentTarget, run);
			return;
		}
		allowSubmit = false;
	}

	function unproduceEnhance() {
		return async ({ update }) => {
			unproduceDialog?.close();
			pendingForm = null;
			pendingRun = null;
			pendingRolls = 0;
			await update({ invalidateAll: true });
		};
	}
</script>

<svelte:head><title>Unproduce - PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">Unproduce</h1>
		<p class="text-sm text-gray-500 mt-0.5">
			{data.selectedDate
				? 'Eligible completed production for selected date'
				: 'Eligible completed production from the last 3 production dates'}
		</p>
	</div>
	<a href="/production" class="btn-secondary btn-sm">Back</a>
</header>

<main class="p-6 space-y-4">
	<div class="card">
		<div class="card-body flex items-end gap-3">
			<div>
				<label for="production_date" class="form-label">Production Date</label>
				<input
					id="production_date"
					type="date"
					class="form-input"
					bind:value={selectedDate}
				/>
			</div>
			<button type="button" class="btn-secondary" onclick={applyDateFilter}>Find</button>
			{#if data.selectedDate}
				<a href="/production/unproduce" class="btn-secondary">Clear</a>
			{/if}
		</div>
	</div>

	{#if form?.error}
		<div class="px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
			{form.error}
		</div>
	{/if}

	<div class="card overflow-x-auto">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">
				{eligibleRuns.length} eligible run{eligibleRuns.length === 1 ? '' : 's'}
			</span>
		</div>
		{#if eligibleRuns.length}
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Date</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">WO / SO</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Job</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Material</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Produced</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Allocated</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Available</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Unproduce</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each eligibleRuns as run (run.id)}
						<tr>
							<td class="px-4 py-3 text-gray-600">{fmtDate(run.run_date)}</td>
							<td class="px-4 py-3 text-gray-700">{run.customer_name}</td>
							<td class="px-4 py-3 text-gray-600">{run.so_number}</td>
							<td class="px-4 py-3 font-medium text-gray-900">{run.job_name}</td>
							<td class="px-4 py-3">
								<span class="font-medium">{run.display_label}</span>
								<span class="text-gray-500 ml-2">{run.facing}</span>
								{#if run.rollfor}
									<span class="text-gray-400 ml-2">{run.rollfor}</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right tabular-nums">
								{run.rolls_actual} rolls
								<span class="text-gray-500">- {fmtSqft(run.sqft_actual)}</span>
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-600">
								{run.allocated_rolls} rolls
								<span class="text-gray-500">- {fmtSqft(run.allocated_sqft)}</span>
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900">
								{run.unshipped_rolls} rolls
								<span class="text-gray-500">- {fmtSqft(run.unshipped_sqft)}</span>
							</td>
							<td class="px-4 py-3">
								<form
									method="POST"
									class="flex justify-end gap-2"
									onsubmit={(e) => handleSubmit(e, run)}
									use:enhance={unproduceEnhance}
								>
									<input type="hidden" name="run_id" value={run.id} />
									<input
										type="hidden"
										name="selected_date"
										value={data.selectedDate ?? ''}
									/>
									<input
										type="number"
										name="rolls_to_unproduce"
										min="1"
										max={run.unshipped_rolls}
										step="1"
										value={run.unshipped_rolls}
										required
										class="form-input w-24 text-right tabular-nums"
										aria-label="Rolls to unproduce"
									/>
									<button
										type="button"
										class="btn-danger btn-sm"
										onclick={(e) => requestUnproduce(e.currentTarget.form, run)}
										>Unproduce</button
									>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-sm text-gray-500">
				No completed production runs have unallocated quantity available to unproduce.
			</div>
		{/if}
	</div>
</main>

<dialog bind:this={unproduceDialog} class="rounded-lg shadow-xl p-6 w-96 backdrop:bg-black/30">
	<p class="text-sm font-medium text-gray-900 mb-1">Unproduce production?</p>
	{#if pendingRun}
		<p class="text-xs text-gray-500 mb-4">
			{pendingRolls} roll{pendingRolls === 1 ? '' : 's'} for {pendingRun.customer_name},
			{pendingRun.so_number}, {pendingRun.job_name} will be unproduced using the original production
			date. Inventory will be restored, and any partial shortfall will merge into an existing open
			run when possible.
		</p>
	{/if}
	<div class="flex gap-2 justify-end">
		<button
			type="button"
			class="btn-secondary btn-sm"
			onclick={() => {
				unproduceDialog.close();
				pendingForm = null;
				pendingRun = null;
				pendingRolls = 0;
			}}>Cancel</button
		>
		<button
			type="button"
			class="btn-danger btn-sm"
			onclick={() => {
				allowSubmit = true;
				pendingForm?.requestSubmit();
			}}>Unproduce</button
		>
	</div>
</dialog>
