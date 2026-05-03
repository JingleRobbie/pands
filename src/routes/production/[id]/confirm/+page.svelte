<script>
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { fmtDate } from '$lib/utils.js';
	let { data, form } = $props();
	const run = $derived(data.run);
	const matrix = $derived(data.matrix);
	let confirmDialog = $state(null);
	let allowConfirmSubmit = $state(false);

	function fmtSqft(n) {
		if (n == null) return '';
		return Math.round(n).toLocaleString();
	}

	function requestConfirm(formElement) {
		if (formElement && !formElement.reportValidity()) return;
		confirmDialog.showModal();
	}

	function handleConfirmSubmit(event) {
		if (!allowConfirmSubmit) {
			event.preventDefault();
			requestConfirm(event.currentTarget);
			return;
		}
		allowConfirmSubmit = false;
	}

	function confirmEnhance() {
		return async ({ update }) => {
			confirmDialog?.close();
			await update();
		};
	}
</script>

<svelte:head><title>Produce Run — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Record Production Run</h1>
	<div class="flex gap-2">
		{#if run.status !== 'COMPLETED'}
			<a href="/production/{run.id}/edit" class="btn-secondary btn-sm">Edit</a>
		{/if}
		<a href="/production" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-lg">
		{#if run.status === 'COMPLETED'}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200"
			>
				This run has already been completed.
			</div>
		{/if}

		{#if form?.error}<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>{/if}

		<div class="card mb-4">
			<div class="card-header">
				<span class="font-semibold text-sm text-gray-700">Run Details</span>
			</div>
			<div class="card-body space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-gray-500">Run #</span>
					<span class="font-mono">{run.run_number}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Job</span>
					<span class="font-medium">{run.job_name}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">WO #</span>
					<span>{run.so_number}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">SKU</span>
					<span>{run.display_label}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Facing</span>
					<span>{run.facing}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Run Date</span>
					<span>{fmtDate(run.run_date)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Scheduled Rolls</span>
					<span class="tabular-nums">{run.rolls_scheduled}</span>
				</div>
			</div>
		</div>

		{#if run.status !== 'COMPLETED'}
			<form method="POST" onsubmit={handleConfirmSubmit} use:enhance={confirmEnhance}>
				<div class="card mb-4">
					<div class="card-header">
						<span class="font-semibold text-sm text-gray-700">Actual Production</span>
					</div>
					<div class="card-body">
						<label for="rolls_actual" class="form-label">Actual Rolls Produced</label>
						<input
							id="rolls_actual"
							type="number"
							name="rolls_actual"
							step="1"
							min="1"
							max={run.rolls_scheduled}
							class="form-input tabular-nums"
							value={run.rolls_scheduled}
							required
						/>
						<p class="text-xs text-gray-400 mt-1">
							This will deduct from inventory and close the run.
						</p>
					</div>
				</div>
				<div class="flex gap-3">
					<button
						type="button"
						class="btn-primary"
						onclick={(e) => requestConfirm(e.currentTarget.form)}
						>Mark Produced</button
					>
					<a href="/production" class="btn-secondary">Cancel</a>
				</div>
				<dialog
					bind:this={confirmDialog}
					class="rounded-lg shadow-xl p-6 w-96 backdrop:bg-black/30"
				>
					<p class="text-sm font-medium text-gray-900 mb-1">Confirm production?</p>
					<p class="text-xs text-gray-500 mb-4">
						Run {run.run_number} will be marked produced. This deducts inventory and cannot
						be undone.
					</p>
					<div class="flex gap-2 justify-end">
						<button
							type="button"
							class="btn-secondary btn-sm"
							onclick={() => confirmDialog.close()}>Cancel</button
						>
						<button
							type="submit"
							class="btn-primary btn-sm"
							onclick={() => (allowConfirmSubmit = true)}>Confirm</button
						>
					</div>
				</dialog>
			</form>
		{/if}
	</div>

	<div class="card overflow-x-auto mt-6">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">Inventory Outlook</span>
		</div>
		<table class="matrix-table w-full text-left border-collapse">
			<thead>
				<tr>
					<th class="min-w-[120px]">Customer/Vendor</th>
					<th class="min-w-[140px]">Description</th>
					<th class="min-w-[90px]">Order #</th>
					<th class="min-w-[70px]">Date</th>
					<th class="min-w-[70px]">Ship</th>
					<th class="min-w-[70px]">Facing</th>
					{#each matrix.skus as sku (sku.id)}
						{@const trimmed = sku.display_label.trim()}
						<th class="sku-col-start min-w-[50px] align-bottom">
							<div class="h-16 relative overflow-visible">
								<span
									class="absolute bottom-1 left-1/2 inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-normal"
								>
									{trimmed} Δ
								</span>
							</div>
						</th>
						<th class="min-w-[80px] align-bottom">
							<div class="h-16 relative overflow-visible">
								<span
									class="absolute bottom-1 left-1/2 inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-normal text-gray-400"
								>
									{trimmed} bal
								</span>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<tr class="row-balance">
					<td></td>
					<td class="font-semibold text-gray-700">Current Inventory</td>
					<td></td>
					<td class="text-xs text-gray-500">today</td>
					<td></td>
					<td></td>
					{#each matrix.skus as sku (sku.id)}
						{@const cell = matrix.balanceRow.cells[sku.id]}
						<td class="sku-col-start"></td>
						<td
							class="text-right font-mono text-sm {cell?.runningTotal < 0
								? 'sqft-negative'
								: ''}"
						>
							{fmtSqft(cell?.runningTotal ?? 0)}
						</td>
					{/each}
				</tr>
				{#each matrix.rows as row (row.rowType + (row.woLineId ?? row.objectId))}
					{@const href =
						row.rowType === 'po'
							? `/po/${row.objectId}`
							: `/wo/${row.objectId}/${row.rowType === 'unscheduled' ? 'schedule' : 'confirm'}`}
					<tr class="row-{row.rowType} cursor-pointer" onclick={() => goto(href)}>
						<td class="text-gray-600 text-sm">{row.partyName ?? ''}</td>
						<td class="font-medium">
							{#if row.rowType === 'po'}
								{@const sc =
									row.status === 'RECEIVED'
										? 'badge-green'
										: row.status === 'CANCELLED'
											? 'badge-red'
											: 'badge-blue'}
								<span class={sc}>{row.status}</span>
							{:else if row.rowType === 'production'}
								{row.description}
							{:else}
								<span class="text-amber-700">{row.description}</span>
							{/if}
						</td>
						<td
							class="text-sm {row.rowType === 'po'
								? 'text-blue-700'
								: row.rowType === 'unscheduled'
									? 'text-amber-700'
									: 'text-gray-600'}"
						>
							{row.soNumber || row.poNumber}
						</td>
						<td class="text-sm text-gray-600">
							{#if row.eventDate}
								{fmtDate(row.eventDate)}
							{:else if row.rowType === 'unscheduled'}
								<span class="text-amber-600 font-semibold">?</span>
							{/if}
						</td>
						<td class="text-sm text-gray-600">
							{#if row.shipDate}{fmtDate(row.shipDate)}{/if}
						</td>
						<td class="text-sm text-gray-600">{row.facing ?? ''}</td>
						{#each matrix.skus as sku (sku.id)}
							{@const cell = row.cells[sku.id]}
							<td
								class="sku-col-start text-right font-mono text-sm"
								onclick={(e) => e.stopPropagation()}
							>
								{#if cell?.delta != null}
									{#if cell.delta > 0}
										<span class="sqft-positive">+{fmtSqft(cell.delta)}</span>
									{:else}
										<span class="sqft-negative"
											>({fmtSqft(Math.abs(cell.delta))})</span
										>
									{/if}
								{/if}
							</td>
							<td
								class="text-right font-mono text-sm {cell?.runningTotal < 0
									? 'sqft-negative'
									: 'text-gray-500'}"
								onclick={(e) => e.stopPropagation()}
							>
								{fmtSqft(cell?.runningTotal ?? 0)}
							</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan="100" class="py-6 text-center text-gray-400 text-sm"
							>No upcoming activity for this SKU.</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>
