<script>
	let { data } = $props();
	const { matrix } = data;

	function fmtDate(d) {
		if (!d) return null;
		const s = typeof d === 'string' ? d : d.toISOString();
		const [, m, day] = s.slice(0, 10).split('-');
		return `${parseInt(m)}/${parseInt(day)}`;
	}

	function fmtSqft(n) {
		if (n == null) return '';
		return Math.round(n).toLocaleString();
	}
</script>

<svelte:head><title>Overview — PandS</title></svelte:head>

<!-- Page header -->
<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Inventory Overview</h1>
	<div class="flex items-center gap-2">
		<a href="/po/new" class="btn-secondary btn-sm">+ PO</a>
		<a href="/so/new" class="btn-secondary btn-sm">+ SO</a>
		<a href="/production/schedule" class="btn-primary btn-sm">Schedule Run</a>
	</div>
</header>

<main class="p-6 overflow-auto">
	<div class="card overflow-x-auto">
		<table class="matrix-table w-full text-left border-collapse">
			<thead>
				<tr>
					<th class="min-w-[140px]">Description</th>
					<th class="min-w-[90px]">SO #</th>
					<th class="min-w-[90px]">PO #</th>
					<th class="min-w-[70px]">Run</th>
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
				<!-- Current inventory balance row -->
				<tr class="row-balance">
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

				<!-- Dated + unscheduled rows -->
				{#each matrix.rows as row (row.rowType + row.objectId)}
					<tr class="row-{row.rowType}">
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
						<td colspan="100" class="py-10 text-center text-gray-400 text-sm">
							No upcoming orders.
							<a href="/po/new" class="underline">Add a PO</a> or
							<a href="/so/new" class="underline">add a Sales Order</a>.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="mt-3 text-xs text-gray-400">
		<span
			class="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-200 mr-1 align-middle"
		></span>PO arrival &nbsp;
		<span
			class="inline-block w-3 h-3 rounded-sm bg-white border border-gray-200 mr-1 align-middle"
		></span>Scheduled production &nbsp;
		<span
			class="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-200 mr-1 align-middle"
		></span>Unscheduled
	</p>
</main>
