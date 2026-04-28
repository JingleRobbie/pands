<script>
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { localDate } from '$lib/utils.js';
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

	const _init = get(page).url.searchParams;
	let selectedThicknesses = $state(
		new Set((_init.get('thickness') ?? '').split(',').filter(Boolean).map(Number))
	);

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

	let historyRange = $state(_init.get('history') ?? 'current');
	const today = localDate();

	$effect(() => {
		const p = new URLSearchParams();
		if (historyRange !== 'current') p.set('history', historyRange);
		if (selectedThicknesses.size > 0) p.set('thickness', [...selectedThicknesses].join(','));
		const qs = p.toString();
		goto(qs ? `?${qs}` : location.pathname, {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	});
	const cutoffDays = { '7d': 7, '30d': 30, '365d': 365 };
	const visibleHistoryRows = $derived(
		historyRange === 'current'
			? []
			: matrix.historyRows.filter((r) => {
					const cutoff = new Date(today);
					cutoff.setDate(cutoff.getDate() - cutoffDays[historyRange]);
					const rowDate =
						typeof r.eventDate === 'string'
							? r.eventDate
							: r.eventDate.toISOString().slice(0, 10);
					return rowDate >= cutoff.toISOString().slice(0, 10);
				})
	);
</script>

<svelte:head><title>Overview — PandS</title></svelte:head>

<!-- Page header -->
<header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Inventory Overview</h1>
	<div class="flex items-center gap-2">
		<select bind:value={historyRange} class="form-select py-1 px-2 h-8">
			<option value="current">Current</option>
			<option value="7d">Last 7 days</option>
			<option value="30d">Last 30 days</option>
			<option value="365d">Last year</option>
		</select>
		<a
			href="/inventory/count"
			class="btn-secondary btn-sm"
			class:opacity-40={data.appUser?.role !== 'admin'}
			class:pointer-events-none={data.appUser?.role !== 'admin'}
			title={data.appUser?.role !== 'admin' ? 'Admin only' : 'Record inventory count'}
			>Record Count</a
		>
		<a href="/po/new" class="btn-secondary btn-sm">+ PO</a>
		<a href="/so/new" class="btn-secondary btn-sm">+ SO</a>
	</div>
</header>

<div class="px-6 pt-2 pb-1 flex items-center gap-2 flex-wrap">
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

<main class="p-3 overflow-auto">
	<div class="card overflow-x-auto">
		<table class="matrix-table w-full text-left border-collapse">
			<thead>
				<tr>
					<th rowspan="2" class="min-w-[100px]">Name</th>
					<th rowspan="2" class="min-w-[100px]">Description</th>
					<th rowspan="2" class="min-w-[70px]">Order #</th>
					<th rowspan="2" class="min-w-[50px]">Run</th>
					<th rowspan="2" class="min-w-[50px]">Ship</th>
					<th rowspan="2" class="min-w-[50px]">Facing</th>
					{#each visibleSkus as sku (sku.id)}
						<th colspan="2" class="sku-col-start text-center"
							>{sku.display_label.trim()}</th
						>
					{/each}
				</tr>
				<tr>
					{#each visibleSkus as sku (sku.id)}
						<th class="sku-col-start min-w-[50px] text-right">Δ</th>
						<th class="min-w-[70px] text-gray-400 font-normal text-right">bal</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<!-- Historical activity rows -->
				{#each visibleHistoryRows as row, i (i)}
					{@const href =
						row.subType === 'po'
							? `/po/${row.objectId}`
							: row.subType === 'adjustment'
								? `/inventory/counts/${row.objectId}`
								: `/wo/${row.objectId}/confirm`}
					<tr class="row-historical cursor-pointer" onclick={() => goto(href)}>
						<td>
							{#if row.subType === 'adjustment'}
								{row.description}
							{:else}
								{row.partyName ?? ''}
							{/if}
						</td>
						<td>
							{#if row.subType === 'po'}
								<span class="badge-green">RECEIVED</span>
							{:else if row.subType === 'adjustment'}
								<span class="badge-amber">ADJUSTMENT</span>
							{:else}
								{row.description}
							{/if}
						</td>
						<td>
							{#if row.subType === 'po'}
								{row.poNumber}
							{:else if row.subType === 'adjustment'}
								{''}
							{:else}
								{row.soNumber || row.poNumber}
							{/if}
						</td>
						<td>{fmtDate(row.eventDate)}</td>
						<td class=""
							>{#if row.shipDate}{fmtDate(row.shipDate)}{/if}</td
						>
						<td class="text-gray-600">{row.facing ?? ''}</td>
						{#each visibleSkus as sku (sku.id)}
							{@const cell = row.cells[sku.id]}
							<td
								class="sku-col-start text-right font-mono"
								onclick={(e) => e.stopPropagation()}
							>
								{#if cell?.delta != null}
									{#if cell.delta > 0}
										<span class="sqft-positive">{fmtSqft(cell.delta)}</span>
									{:else if cell.delta === 0}
										<span class="sqft-negative">{fmtSqft(0)}</span>
									{:else}
										<span class="sqft-negative"
											>({fmtSqft(Math.abs(cell.delta))})</span
										>
									{/if}
								{/if}
							</td>
							<td class="text-right font-mono" onclick={(e) => e.stopPropagation()}>
								{#if (cell?.runningTotal ?? 0) > 0}
									<span class="sqft-positive">{fmtSqft(cell.runningTotal)}</span>
								{:else if (cell?.runningTotal ?? 0) === 0}
									<span class="sqft-negative">0</span>
								{:else}
									<span class="sqft-negative"
										>({fmtSqft(Math.abs(cell.runningTotal))})</span
									>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}

				<!-- Current inventory balance row -->
				<tr class="row-balance">
					<td></td>
					<td></td><td></td>
					<td colspan="3" class="font-semibold text-gray-700">Current Inventory</td>
					{#each visibleSkus as sku (sku.id)}
						{@const cell = matrix.balanceRow.cells[sku.id]}
						<td class="sku-col-start"></td>
						<td class="text-right font-mono">
							{#if (cell?.runningTotal ?? 0) > 0}
								<span class="sqft-positive">{fmtSqft(cell.runningTotal)}</span>
							{:else if (cell?.runningTotal ?? 0) === 0}
								<span class="sqft-negative">0</span>
							{:else}
								<span class="sqft-negative"
									>({fmtSqft(Math.abs(cell.runningTotal))})</span
								>
							{/if}
						</td>
					{/each}
				</tr>

				<!-- Dated + unscheduled rows -->
				{#each matrix.rows as row (row.rowType + (row.groupId ?? row.woLineId ?? row.objectId))}
					{@const href =
						row.rowType === 'po'
							? `/po/${row.objectId}`
							: `/wo/${row.objectId}/${row.rowType === 'unscheduled' ? 'schedule' : 'confirm'}`}
					<tr class="row-{row.rowType} cursor-pointer" onclick={() => goto(href)}>
						<td class="text-gray-600">{row.partyName ?? ''}</td>
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
							class={row.rowType === 'po'
								? 'text-blue-700'
								: row.rowType === 'unscheduled'
									? 'text-amber-700'
									: 'text-gray-600'}
						>
							{row.soNumber || row.poNumber}
						</td>
						<td class="text-gray-600">
							{#if row.eventDate}
								{fmtDate(row.eventDate)}
							{:else if row.rowType === 'unscheduled'}
								<span class="text-amber-600 font-semibold">?</span>
							{/if}
						</td>
						<td class="text-gray-600">
							{#if row.shipDate}{fmtDate(row.shipDate)}{/if}
						</td>
						<td class="text-gray-600">{row.facing ?? ''}</td>
						{#each visibleSkus as sku (sku.id)}
							{@const cell = row.cells[sku.id]}
							<td
								class="sku-col-start text-right font-mono"
								onclick={(e) => e.stopPropagation()}
							>
								{#if cell?.delta != null}
									{#if cell.delta > 0}
										<span class="sqft-positive">{fmtSqft(cell.delta)}</span>
									{:else if cell.delta === 0}
										<span class="sqft-negative">{fmtSqft(0)}</span>
									{:else}
										<span class="sqft-negative"
											>({fmtSqft(Math.abs(cell.delta))})</span
										>
									{/if}
								{/if}
							</td>
							<td class="text-right font-mono" onclick={(e) => e.stopPropagation()}>
								{#if (cell?.runningTotal ?? 0) > 0}
									<span class="sqft-positive">{fmtSqft(cell.runningTotal)}</span>
								{:else if (cell?.runningTotal ?? 0) === 0}
									<span class="sqft-negative">0</span>
								{:else}
									<span class="sqft-negative"
										>({fmtSqft(Math.abs(cell.runningTotal))})</span
									>
								{/if}
							</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan="100" class="py-10 text-center text-gray-400">
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
