<script>
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	let { data, form } = $props();
	const { so, runs, matrix } = data;

	const scheduledRuns = $derived(runs.filter((r) => r.status === 'SCHEDULED'));
	const confirmedRuns = $derived(runs.filter((r) => r.status === 'COMPLETED'));

	function fmtDate(d) {
		if (!d) return '?';
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

<svelte:head><title>Confirm Job — {so.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">Confirm Job — {so.so_number}</h1>
		<p class="text-sm text-gray-500 mt-0.5">{so.customer_name} · {so.job_name}</p>
	</div>
	<a href="/production" class="btn-secondary btn-sm">Back</a>
</header>

<main class="p-6">
	<div class="max-w-2xl">
		{#if form?.error}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>
		{/if}

		{#if scheduledRuns.length === 0}
			<div class="card">
				<div class="card-body text-sm text-gray-500">
					All production runs for this job are already completed.
				</div>
			</div>
		{:else}
			<form method="POST" use:enhance>
				<div class="card mb-4">
					<div class="card-header">
						<span class="font-semibold text-sm text-gray-700">Runs to Confirm</span>
						<span class="text-xs text-gray-400">{scheduledRuns.length} scheduled</span>
					</div>
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-100">
								<th class="px-4 py-2 text-left text-gray-600">Run #</th>
								<th class="px-4 py-2 text-left text-gray-600">SKU</th>
								<th class="px-4 py-2 text-left text-gray-600">Date</th>
								<th class="px-4 py-2 text-right text-gray-600">Scheduled</th>
								<th class="px-4 py-2 text-right text-gray-600">Actual Sqft</th>
							</tr>
						</thead>
						<tbody>
							{#each scheduledRuns as run (run.id)}
								<tr class="border-b border-gray-50">
									<td class="px-4 py-2 font-mono text-xs">{run.run_number}</td>
									<td class="px-4 py-2">{run.sku_label}</td>
									<td class="px-4 py-2 text-gray-600">{fmtDate(run.run_date)}</td>
									<td class="px-4 py-2 text-right font-mono text-gray-500">
										{fmtSqft(run.sqft_scheduled)}
									</td>
									<td class="px-4 py-2 text-right">
										<input type="hidden" name="run_id" value={run.id} />
										<input
											type="number"
											name="sqft_{run.id}"
											value={run.sqft_scheduled}
											min="1"
											step="1"
											required
											class="form-input w-28 text-right font-mono"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="flex gap-3">
					<button type="submit" class="btn-primary">Confirm &amp; Deduct Inventory</button
					>
					<a href="/production" class="btn-secondary">Cancel</a>
				</div>
			</form>
		{/if}

		{#if confirmedRuns.length > 0}
			<div class="card mt-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">Already Completed</span>
				</div>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">Run #</th>
							<th class="px-4 py-2 text-left text-gray-600">SKU</th>
							<th class="px-4 py-2 text-left text-gray-600">Date</th>
							<th class="px-4 py-2 text-right text-gray-600">Actual Sqft</th>
						</tr>
					</thead>
					<tbody>
						{#each confirmedRuns as run (run.id)}
							<tr class="border-b border-gray-50 text-gray-400">
								<td class="px-4 py-2 font-mono text-xs">{run.run_number}</td>
								<td class="px-4 py-2">{run.sku_label}</td>
								<td class="px-4 py-2">{fmtDate(run.run_date)}</td>
								<td class="px-4 py-2 text-right font-mono"
									>{fmtSqft(run.sqft_actual)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	{#if matrix}
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
						{@const href =
							row.rowType === 'po'
								? `/po/${row.objectId}`
								: row.rowType === 'production'
									? `/production/${row.objectId}/confirm`
									: `/so/${row.objectId}`}
						<tr class="row-{row.rowType} cursor-pointer" onclick={() => goto(href)}>
							<td class="text-gray-600 text-sm">{row.partyName ?? ''}</td>
							<td class="font-medium">
								{#if row.rowType === 'po'}
									{@const sc =
										row.status === 'CANCELLED' ? 'badge-red' : 'badge-blue'}
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
							{#each matrix.skus as sku (sku.id)}
								{@const cell = row.cells[sku.id]}
								<td
									class="sku-col-start text-right font-mono text-sm"
									onclick={(e) => e.stopPropagation()}
								>
									{#if cell?.delta != null}
										{#if cell.delta > 0}
											<span class="sqft-positive">+{fmtSqft(cell.delta)}</span
											>
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
							<td colspan="100" class="py-6 text-center text-gray-400 text-sm">
								No upcoming activity for these SKUs.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
