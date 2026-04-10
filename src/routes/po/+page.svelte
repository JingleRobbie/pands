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
</script>

<svelte:head><title>Purchase Orders — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Purchase Orders</h1>
	<a href="/po/new" class="btn-primary btn-sm">+ New PO</a>
</header>
<main class="p-6 space-y-4">
	{#if data.overdue.length}
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-amber-700">Overdue</span>
			</div>
			<table class="w-full text-sm">
				<thead
					><tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">PO #</th>
						<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
						<th class="px-4 py-2 text-left text-gray-600">Expected</th>
						<th class="px-4 py-2 text-right"></th>
					</tr></thead
				>
				<tbody>
					{#each data.overdue as po}
						<tr class="border-b border-gray-50 hover:bg-gray-50">
							<td class="px-4 py-2 font-medium"
								><a href="/po/{po.id}" class="text-blue-700 hover:underline"
									>{po.po_number}</a
								></td
							>
							<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
							<td class="px-4 py-2 text-amber-600">{fmtDate(po.expected_date)}</td>
							<td class="px-4 py-2 text-right"
								><a href="/po/{po.id}/receive" class="btn-primary btn-sm">Receive</a
								></td
							>
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
			<table class="w-full text-sm">
				<thead
					><tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">PO #</th>
						<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
						<th class="px-4 py-2 text-left text-gray-600">Expected</th>
						<th class="px-4 py-2 text-left text-gray-600">Lines</th>
						<th class="px-4 py-2 text-right"></th>
					</tr></thead
				>
				<tbody>
					{#each data.upcoming as po}
						<tr class="border-b border-gray-50 hover:bg-gray-50">
							<td class="px-4 py-2"
								><a
									href="/po/{po.id}"
									class="font-medium text-blue-700 hover:underline"
									>{po.po_number}</a
								></td
							>
							<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
							<td class="px-4 py-2 text-gray-600">{fmtDate(po.expected_date)}</td>
							<td class="px-4 py-2 text-gray-500">{po.line_count}</td>
							<td class="px-4 py-2 text-right"
								><a href="/po/{po.id}/receive" class="btn-primary btn-sm">Receive</a
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">No upcoming purchase orders.</div>
		{/if}
	</div>
</main>
