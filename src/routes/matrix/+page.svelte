<script>
	import { goto } from '$app/navigation';
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

	const thicknesses = $derived(
		[...new Set(matrix.skus.map((s) => s.thickness_in))].sort((a, b) => a - b)
	);

	let selectedThicknesses = $state(new Set());

	const visibleSkus = $derived(
		selectedThicknesses.size === 0
			? matrix.skus
			: matrix.skus.filter((s) => selectedThicknesses.has(s.thickness_in))
	);

	function toggleThickness(t) {
		const next = new Set(selectedThicknesses);
		next.has(t) ? next.delete(t) : next.add(t);
		selectedThicknesses = next;
	}

	// TODO: change to false once toggle UX is finalized
	let showHistory = $state(true);
</script>

<svelte:head><title>Overview — PandS</title></svelte:head>

<!-- Page header -->
<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Inventory Overview</h1>
	<div class="flex items-center gap-2">
		<button onclick={() => (showHistory = !showHistory)} class="btn-secondary btn-sm">
			{showHistory ? 'Hide History' : 'Show History'}
		</button>
		<a href="/po/new" class="btn-secondary btn-sm">+ PO</a>
		<a href="/so/new" class="btn-secondary btn-sm">+ SO</a>
		<a href="/production/schedule" class="btn-primary btn-sm">Schedule Run</a>
	</div>
</header>

<div class="px-6 pt-4 pb-2 flex items-center gap-2 flex-wrap">
	{#each thicknesses as t (t)}
		<button
			onclick={() => toggleThickness(t)}
			class="btn-sm {selectedThicknesses.has(t) ? 'btn-primary' : 'btn-secondary'}"
		>
			{t}"
		</button>
	{/each}
	{#if selectedThicknesses.size > 0}
		<button
			onclick={() => (selectedThicknesses = new Set())}
			class="btn-sm btn-secondary text-gray-500"
		>
			Clear
		</button>
	{/if}
</div>

<main class="p-6 overflow-auto">
	<div class="card overflow-x-auto">
		<table class="matrix-table w-full text-left border-collapse">
			<thead>
				<tr>
					<th class="min-w-[120px]">Name</th>
					<th class="min-w-[140px]">Description</th>
					<th class="min-w-[90px]">Order #</th>
					<th class="min-w-[70px]">Run</th>
					<th class="min-w-[70px]">Ship</th>
					{#each visibleSkus as sku (sku.id)}
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
						<th class="min-w-[90px] align-bottom">
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
				<!-- Historical activity rows (past 2 days) -->
				{#if showHistory}
					{#each matrix.historyRows as row (`${row.subType}-${row.objectId}`)}
						{@const href =
							row.subType === 'po'
								? `/po/${row.objectId}`
								: `/production/${row.objectId}/confirm`}
						<tr class="row-historical cursor-pointer" onclick={() => goto(href)}>
							<td class="text-sm">{row.partyName ?? ''}</td>
							<td class="text-sm">
								{#if row.subType === 'po'}
									<span class="badge-green">{row.status}</span>
								{:else}
									{row.description}
								{/if}
							</td>
							<td class="text-sm">
								{#if row.subType === 'po'}
									{row.poNumber}
								{:else}
									{row.soNumber || row.poNumber}
								{/if}
							</td>
							<td class="text-sm">{fmtDate(row.eventDate)}</td>
							<td class="text-sm"
								>{#if row.shipDate}{fmtDate(row.shipDate)}{/if}</td
							>
							{#each visibleSkus as sku (sku.id)}
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
									class="text-right font-mono text-sm {(cell?.runningTotal ?? 0) <
									0
										? 'sqft-negative'
										: 'text-gray-400'}"
									onclick={(e) => e.stopPropagation()}
								>
									{fmtSqft(cell?.runningTotal ?? 0)}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}

				<!-- Current inventory balance row -->
				<tr class="row-balance">
					<td></td>
					<td></td><td></td>
					<td colspan="2" class="font-semibold text-gray-700">Current Inventory</td>
					{#each visibleSkus as sku (sku.id)}
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
						{#each visibleSkus as sku (sku.id)}
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
</main>
