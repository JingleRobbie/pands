<script>
	let { data } = $props();
	const { so, lineData, matrix } = data;
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

<svelte:head><title>SO {so.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">SO {so.so_number} — {so.job_name}</h1>
	<div class="flex gap-2">
		{#if so.status === 'OPEN' || so.status === 'IN_PROGRESS'}
			<a href="/so/{so.id}/edit" class="btn-secondary btn-sm">Edit</a>
		{/if}
		<a href="/production/schedule?so={so.id}" class="btn-primary btn-sm">Schedule Run</a>
		<a href="/so" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-3xl space-y-3">
		<div class="card">
			<div class="card-body grid grid-cols-4 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Customer</span>
					<p class="font-medium mt-0.5">{so.customer_name}</p>
				</div>
				<div>
					<span class="text-gray-500">Ship Date</span>
					<p class="font-medium mt-0.5">
						{new Date(so.ship_date).toLocaleDateString('en-US', {
							month: 'numeric',
							day: 'numeric',
							year: 'numeric',
							timeZone: 'UTC',
						})}
					</p>
				</div>
				<div>
					<span class="text-gray-500">Status</span>
					<p class="mt-0.5">
						{#if so.status === 'OPEN'}<span class="badge-blue">Open</span>
						{:else if so.status === 'IN_PROGRESS'}<span class="badge-amber"
								>In Progress</span
							>
						{:else if so.status === 'COMPLETE'}<span class="badge-green">Complete</span>
						{:else}<span class="badge-gray">{so.status}</span>{/if}
					</p>
				</div>
			</div>
		</div>

		{#each lineData as item (item.line.id)}
			<div class="card">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-800"
						>{item.line.display_label}</span
					>
					<div class="flex items-center gap-4 text-xs text-gray-500">
						<span
							>Ordered: <strong class="text-gray-800 font-mono"
								>{Math.round(item.line.sqft_ordered).toLocaleString()}</strong
							> sqft</span
						>
						<span
							>Produced: <strong class="text-gray-800 font-mono"
								>{Math.round(item.line.sqft_produced).toLocaleString()}</strong
							> sqft</span
						>
						{#if item.sqftUnscheduled > 0}
							<span class="text-amber-700"
								>Unscheduled: <strong class="font-mono"
									>{Math.round(item.sqftUnscheduled).toLocaleString()}</strong
								> sqft</span
							>
						{:else}
							<span class="text-green-700">Fully scheduled</span>
						{/if}
					</div>
				</div>
				{#if item.runs.length}
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-gray-100">
								<th class="px-4 py-1.5 text-left text-gray-500">Run #</th>
								<th class="px-4 py-1.5 text-left text-gray-500">Date</th>
								<th class="px-4 py-1.5 text-right text-gray-500">Sqft</th>
								<th class="px-4 py-1.5 text-left text-gray-500">Status</th>
							</tr></thead
						>
						<tbody>
							{#each item.runs as run (run.id)}
								<tr class="border-b border-gray-50">
									<td class="px-4 py-1.5 font-mono">{run.run_number}</td>
									<td class="px-4 py-1.5">{fmtDate(run.run_date)}</td>
									<td class="px-4 py-1.5 text-right font-mono"
										>{Math.round(run.sqft_scheduled).toLocaleString()}</td
									>
									<td class="px-4 py-1.5">
										{#if run.status === 'SCHEDULED'}<span class="badge-blue"
												>Scheduled</span
											>
										{:else}<span class="badge-amber">Unscheduled</span>{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/each}
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
						<th class="min-w-[40px] align-bottom pb-1 text-center">
							<span class="inline-block [writing-mode:vertical-rl] rotate-180"
								>{sku.display_label}</span
							>
						</th>
						<th class="min-w-[80px] text-right text-gray-400 font-normal">← total</th>
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
						<td></td>
						<td
							class="text-right font-mono text-sm {cell?.runningTotal < 0
								? 'sqft-negative'
								: ''}"
						>
							{fmtSqft(cell?.runningTotal ?? 0)}
						</td>
					{/each}
				</tr>
				{#each matrix.rows as row (row.objectId)}
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
							<td class="text-right font-mono text-sm">
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
							>No upcoming activity for these SKUs.</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>
