<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const { matrix } = data;
	function fmtDate(d) {
		if (!d) return null;
		const s = typeof d === 'string' ? d : d.toISOString();
		const [year, m, day] = s.slice(0, 10).split('-');
		return new Date(+year, +m - 1, +day).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}
	function fmtSqft(n) {
		if (n == null) return '';
		return Math.round(n).toLocaleString();
	}
</script>

<svelte:head><title>Confirm Run — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Confirm Production Run</h1>
	{#if data.run.status !== 'CONFIRMED'}
		<a href="/production/{data.run.id}/edit" class="btn-secondary btn-sm">Edit</a>
	{/if}
	<a href="/production" class="btn-secondary btn-sm">Back</a>
</header>
<main class="p-6">
	<div class="max-w-lg">
		{#if data.run.status === 'CONFIRMED'}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200"
			>
				This run has already been confirmed.
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
					<span class="font-mono">{data.run.run_number}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Job</span>
					<span class="font-medium">{data.run.job_name}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">SO #</span>
					<span>{data.run.so_number}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">SKU</span>
					<span>{data.run.display_label}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Run Date</span>
					<span>{fmtDate(data.run.run_date)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Scheduled Sqft</span>
					<span class="font-mono"
						>{Math.round(data.run.sqft_scheduled).toLocaleString()}</span
					>
				</div>
			</div>
		</div>

		{#if data.run.status !== 'CONFIRMED'}
			<form method="POST" use:enhance>
				<div class="card mb-4">
					<div class="card-header">
						<span class="font-semibold text-sm text-gray-700">Actual Production</span>
					</div>
					<div class="card-body">
						<label for="sqft_actual" class="form-label">Actual Sq Ft Produced</label>
						<input
							id="sqft_actual"
							type="number"
							name="sqft_actual"
							step="1"
							min="1"
							class="form-input font-mono"
							value={data.run.sqft_scheduled}
							required
						/>
						<p class="text-xs text-gray-400 mt-1">
							This will deduct from inventory and close the run.
						</p>
					</div>
				</div>
				<div class="flex gap-3">
					<button type="submit" class="btn-primary">Confirm &amp; Deduct Inventory</button
					>
					<a href="/production" class="btn-secondary">Cancel</a>
				</div>
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
					<th class="min-w-[90px]">SO #</th>
					<th class="min-w-[90px]">PO #</th>
					<th class="min-w-[70px]">Date</th>
					<th class="min-w-[70px]">Ship</th>
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
					<td></td><td></td>
					<td class="text-xs text-gray-500">today</td>
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
				{#each matrix.rows as row (row.rowType + row.objectId)}
					<tr class="row-{row.rowType}">
						<td class="text-gray-600 text-sm">{row.partyName ?? ''}</td>
						<td class="font-medium">
							{#if row.rowType === 'po'}
								<a href="/po/{row.objectId}" class="hover:underline text-blue-700"
									>{row.description}</a
								>
							{:else if row.rowType === 'production'}
								<a href="/production/{row.objectId}/confirm" class="hover:underline"
									>{row.description}</a
								>
							{:else}
								<a href="/so/{row.objectId}" class="hover:underline text-amber-700"
									>{row.description}</a
								>
							{/if}
						</td>
						<td class="text-gray-600 text-sm">{row.soNumber}</td>
						<td class="text-gray-600 text-sm">{row.poNumber}</td>
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
						{#each matrix.skus as sku (sku.id)}
							{@const cell = row.cells[sku.id]}
							<td class="sku-col-start text-right font-mono text-sm">
								{#if cell?.delta != null}
									<span class={cell.delta > 0 ? 'sqft-positive' : ''}>
										{cell.delta > 0 ? '+' : ''}{fmtSqft(cell.delta)}
									</span>
								{/if}
							</td>
							<td
								class="text-right font-mono text-sm {cell?.runningTotal < 0
									? 'sqft-negative'
									: 'text-gray-500'}"
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
