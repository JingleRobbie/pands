<script>
	import { goto } from '$app/navigation';
	import { fmtDate } from '$lib/utils.js';
	let { data } = $props();
	function statusBadge(s) {
		if (s === 'OPEN') return 'badge-blue';
		if (s === 'CANCELLED') return 'badge-gray';
		return 'badge-gray';
	}
	function statusLabel(s) {
		if (s === 'OPEN') return 'Open';
		if (s === 'CANCELLED') return 'Cancelled';
		return s;
	}
	function tabClass(val) {
		return data.status === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}
</script>

<svelte:head><title>Purchase Orders — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Purchase Orders</h1>
	<div class="flex gap-2">
		<a href="/po/import" class="btn-secondary btn-sm">Import CSV</a>
		<a href="/po/new" class="btn-primary btn-sm">+ New PO</a>
	</div>
</header>
<main class="p-6 space-y-4">
	<nav class="flex gap-1">
		<a href="/po" class={tabClass('')}>Active</a>
		<a href="/po?status=open" class={tabClass('open')}>Open</a>
		<a href="/po?status=cancelled" class={tabClass('cancelled')}>Cancelled</a>
		<a href="/po?status=all" class={tabClass('all')}>All</a>
	</nav>

	{#if data.searchResults !== null}
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">
					{data.searchResults.length} result{data.searchResults.length === 1 ? '' : 's'}
				</span>
			</div>
			{#if data.searchResults.length}
				<table class="w-full text-sm list-table">
					<thead>
						<tr
							class="border-b border-gray-100 cursor-pointer"
							onclick={() => goto(`/po/${po.id}`)}
						>
							<th class="px-4 py-2 text-left text-gray-600">PO #</th>
							<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
							<th class="px-4 py-2 text-left text-gray-600">Expected / Received</th>
							<th class="px-4 py-2 text-left text-gray-600">Status</th>
							<th class="px-4 py-2 text-left text-gray-600">Lines</th>
							<th class="px-4 py-2 text-right"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.searchResults as po (po.id)}
							<tr
								class="border-b border-gray-100 cursor-pointer"
								onclick={() => goto(`/po/${po.id}`)}
							>
								<td class="px-4 py-2 font-medium">
									<a href="/po/{po.id}" class="text-blue-700 hover:underline"
										>{po.po_number}</a
									>
								</td>
								<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
								<td class="px-4 py-2">
									{#if po.received_at}
										<span class="text-gray-700">{fmtDate(po.received_at)}</span>
										{#if fmtDate(po.received_at) !== fmtDate(po.expected_date)}
											<br /><span class="text-xs text-gray-400"
												>exp. {fmtDate(po.expected_date)}</span
											>
										{/if}
									{:else}
										<span class="text-gray-600"
											>{fmtDate(po.expected_date)}</span
										>
									{/if}
								</td>
								<td class="px-4 py-2">
									<span class={statusBadge(po.status)}
										>{statusLabel(po.status)}</span
									>
								</td>
								<td class="px-4 py-2 text-gray-500">{po.line_count}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="card-body text-gray-400 text-sm">No purchase orders found.</div>
			{/if}
		</div>
	{:else}
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Active</span>
			</div>
			{#if data.overdue.length || data.upcoming.length}
				<table class="w-full text-sm list-table">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">PO #</th>
							<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
							<th class="px-4 py-2 text-left text-gray-600">Expected / Received</th>
							<th class="px-4 py-2 text-left text-gray-600">Status</th>
							<th class="px-4 py-2 text-left text-gray-600">Lines</th>
						</tr>
					</thead>
					<tbody>
						{#each data.overdue as po (po.id)}
							<tr
								class="border-b border-amber-100 bg-amber-50 cursor-pointer border-l-2 border-l-amber-400"
								onclick={() => goto(`/po/${po.id}`)}
							>
								<td class="px-4 py-2">
									<a
										href="/po/{po.id}"
										class="font-medium text-blue-700 hover:underline"
										>{po.po_number}</a
									>
								</td>
								<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
								<td class="px-4 py-2 text-amber-700 font-medium"
									>{fmtDate(po.expected_date)}</td
								>
								<td class="px-4 py-2">
									<span class="badge-amber">Overdue</span>
								</td>
								<td class="px-4 py-2 text-gray-500">{po.line_count}</td>
							</tr>
						{/each}

						{#if data.overdue.length && data.upcoming.length}
							<tr>
								<td
									colspan="5"
									class="px-4 py-1 bg-gray-50 border-y border-gray-200"
								>
									<span
										class="text-xs font-medium text-gray-400 uppercase tracking-wide"
										>Upcoming</span
									>
								</td>
							</tr>
						{/if}

						{#each data.upcoming as po (po.id)}
							<tr
								class="border-b border-gray-100 cursor-pointer"
								onclick={() => goto(`/po/${po.id}`)}
							>
								<td class="px-4 py-2">
									<a
										href="/po/{po.id}"
										class="font-medium text-blue-700 hover:underline"
										>{po.po_number}</a
									>
								</td>
								<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
								<td class="px-4 py-2">
									{#if po.received_at}
										<span class="text-gray-700">{fmtDate(po.received_at)}</span>
										{#if fmtDate(po.received_at) !== fmtDate(po.expected_date)}
											<br /><span class="text-xs text-gray-400"
												>exp. {fmtDate(po.expected_date)}</span
											>
										{/if}
									{:else}
										<span class="text-gray-600"
											>{fmtDate(po.expected_date)}</span
										>
									{/if}
								</td>
								<td class="px-4 py-2">
									<span class={statusBadge(po.status)}
										>{statusLabel(po.status)}</span
									>
								</td>
								<td class="px-4 py-2 text-gray-500">{po.line_count}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="card-body text-gray-400 text-sm">No active purchase orders.</div>
			{/if}
		</div>
	{/if}
</main>
