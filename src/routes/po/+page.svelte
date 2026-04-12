<script>
	let { data } = $props();
	function fmtDate(d) {
		if (!d) return '';
		return new Date(d).toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}
	function statusBadge(s) {
		if (s === 'OPEN') return 'badge-blue';
		if (s === 'RECEIVED') return 'badge-green';
		if (s === 'CANCELLED') return 'badge-gray';
		return 'badge-gray';
	}
	function statusLabel(s) {
		if (s === 'OPEN') return 'Open';
		if (s === 'RECEIVED') return 'Received';
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
	<a href="/po/new" class="btn-primary btn-sm">+ New PO</a>
</header>
<main class="p-6 space-y-4">
	<nav class="flex gap-1">
		<a href="/po" class={tabClass('')}>Active</a>
		<a href="/po?status=open" class={tabClass('open')}>Open</a>
		<a href="/po?status=received" class={tabClass('received')}>Received</a>
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
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">PO #</th>
							<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
							<th class="px-4 py-2 text-left text-gray-600">Expected</th>
							<th class="px-4 py-2 text-left text-gray-600">Status</th>
							<th class="px-4 py-2 text-left text-gray-600">Lines</th>
							<th class="px-4 py-2 text-right"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.searchResults as po (po.id)}
							<tr class="border-b border-gray-100">
								<td class="px-4 py-2 font-medium">
									<a href="/po/{po.id}" class="text-blue-700 hover:underline"
										>{po.po_number}</a
									>
								</td>
								<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
								<td class="px-4 py-2 text-gray-600">{fmtDate(po.expected_date)}</td>
								<td class="px-4 py-2">
									<span class={statusBadge(po.status)}
										>{statusLabel(po.status)}</span
									>
								</td>
								<td class="px-4 py-2 text-gray-500">{po.line_count}</td>
								<td class="px-4 py-2 text-right">
									{#if po.status === 'OPEN'}
										<a href="/po/{po.id}/receive" class="btn-primary btn-sm"
											>Receive</a
										>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="card-body text-gray-400 text-sm">No purchase orders found.</div>
			{/if}
		</div>
	{:else}
		{#if data.overdue.length}
			<div class="card">
				<div class="card-header">
					<span class="text-sm font-semibold text-amber-700">Overdue</span>
				</div>
				<table class="w-full text-sm list-table">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">PO #</th>
							<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
							<th class="px-4 py-2 text-left text-gray-600">Expected</th>
							<th class="px-4 py-2 text-right"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.overdue as po (po.id)}
							<tr class="border-b border-gray-100">
								<td class="px-4 py-2 font-medium">
									<a href="/po/{po.id}" class="text-blue-700 hover:underline"
										>{po.po_number}</a
									>
								</td>
								<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
								<td class="px-4 py-2 text-amber-600">{fmtDate(po.expected_date)}</td
								>
								<td class="px-4 py-2 text-right">
									<a href="/po/{po.id}/receive" class="btn-primary btn-sm"
										>Receive</a
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Upcoming</span>
			</div>
			{#if data.upcoming.length}
				<table class="w-full text-sm list-table">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">PO #</th>
							<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
							<th class="px-4 py-2 text-left text-gray-600">Expected</th>
							<th class="px-4 py-2 text-left text-gray-600">Lines</th>
							<th class="px-4 py-2 text-right"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.upcoming as po (po.id)}
							<tr class="border-b border-gray-100">
								<td class="px-4 py-2">
									<a
										href="/po/{po.id}"
										class="font-medium text-blue-700 hover:underline"
										>{po.po_number}</a
									>
								</td>
								<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
								<td class="px-4 py-2 text-gray-600">{fmtDate(po.expected_date)}</td>
								<td class="px-4 py-2 text-gray-500">{po.line_count}</td>
								<td class="px-4 py-2 text-right">
									<a href="/po/{po.id}/receive" class="btn-primary btn-sm"
										>Receive</a
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="card-body text-gray-400 text-sm">No upcoming purchase orders.</div>
			{/if}
		</div>
	{/if}
</main>
