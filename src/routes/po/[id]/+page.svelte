<script>
	let { data } = $props();
	const { po, lines, matrix } = data;

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

<svelte:head><title>PO {po.po_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">PO {po.po_number}</h1>
		<p class="text-sm text-gray-500 mt-0.5">{po.vendor_name}</p>
	</div>
	<div class="flex gap-2">
		{#if po.status === 'OPEN'}
			<a href="/po/{po.id}/edit" class="btn-secondary btn-sm">Edit</a>
			<a href="/po/{po.id}/receive" class="btn-primary btn-sm">Receive</a>
		{/if}
		<a href="/po" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-2xl">
		<div class="card mb-4">
			<div class="card-body grid grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Vendor</span>
					<p class="font-medium mt-0.5">{po.vendor_name}</p>
				</div>
				<div>
					<span class="text-gray-500">Expected</span>
					<p class="font-medium mt-0.5">{fmtDate(po.expected_date)}</p>
				</div>
				<div>
					<span class="text-gray-500">Status</span>
					<p class="mt-0.5">
						{#if po.status === 'OPEN'}<span class="badge-blue">Open</span>
						{:else if po.status === 'RECEIVED'}<span class="badge-green">Received</span>
						{:else}<span class="badge-gray">{po.status}</span>{/if}
					</p>
				</div>
			</div>
		</div>
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Lines</span>
			</div>
			<table class="w-full text-sm">
				<thead
					><tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">SKU</th>
						<th class="px-4 py-2 text-right text-gray-600">Ordered</th>
						<th class="px-4 py-2 text-right text-gray-600">Received</th>
						<th class="px-4 py-2 text-left text-gray-600">Status</th>
					</tr></thead
				>
				<tbody>
					{#each lines as line (line.id)}
						<tr class="border-b border-gray-50">
							<td class="px-4 py-2 font-medium">{line.display_label}</td>
							<td class="px-4 py-2 text-right font-mono"
								>{Math.round(line.sqft_ordered).toLocaleString()}</td
							>
							<td class="px-4 py-2 text-right font-mono"
								>{line.sqft_received
									? Math.round(line.sqft_received).toLocaleString()
									: '—'}</td
							>
							<td class="px-4 py-2">
								{#if line.status === 'OPEN'}<span class="badge-blue">Open</span>
								{:else if line.status === 'RECEIVED'}<span class="badge-green"
										>Received</span
									>
								{:else}<span class="badge-gray">{line.status}</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
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
				{#each matrix.rows as row (row.id)}
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
