<script>
	let { data } = $props();
	function fmtDate(d) {
		return new Date(d).toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}
	function statusBadge(s) {
		if (s === 'OPEN') return 'badge-blue';
		if (s === 'IN_PROGRESS') return 'badge-amber';
		if (s === 'COMPLETE') return 'badge-green';
		if (s === 'CANCELLED') return 'badge-gray';
		return 'badge-gray';
	}
	function statusLabel(s) {
		if (s === 'IN_PROGRESS') return 'In Progress';
		return s.charAt(0) + s.slice(1).toLowerCase();
	}
	function tabClass(val) {
		return data.status === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}
</script>

<svelte:head><title>Sales Orders — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Sales Orders</h1>
	<a href="/so/new" class="btn-primary btn-sm">+ New SO</a>
</header>
<main class="p-6 space-y-4">
	<nav class="flex gap-1">
		<a href="/so" class={tabClass('')}>Active</a>
		<a href="/so?status=open" class={tabClass('open')}>Open</a>
		<a href="/so?status=in_progress" class={tabClass('in_progress')}>In Progress</a>
		<a href="/so?status=complete" class={tabClass('complete')}>Complete</a>
		<a href="/so?status=cancelled" class={tabClass('cancelled')}>Cancelled</a>
		<a href="/so?status=all" class={tabClass('all')}>All</a>
	</nav>

	<div class="card">
		{#if data.searchResults !== null}
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">
					{data.searchResults.length} result{data.searchResults.length === 1 ? '' : 's'}
				</span>
			</div>
			{#if data.searchResults.length}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">SO #</th>
							<th class="px-4 py-2 text-left text-gray-600">Customer</th>
							<th class="px-4 py-2 text-left text-gray-600">Job Name</th>
							<th class="px-4 py-2 text-left text-gray-600">Ship Date</th>
							<th class="px-4 py-2 text-left text-gray-600">Status</th>
							<th class="px-4 py-2 text-right text-gray-600">Lines</th>
						</tr>
					</thead>
					<tbody>
						{#each data.searchResults as so (so.id)}
							<tr class="border-b border-gray-50 hover:bg-gray-50">
								<td class="px-4 py-2">
									<a
										href="/so/{so.id}"
										class="font-medium text-blue-700 hover:underline"
										>{so.so_number}</a
									>
								</td>
								<td class="px-4 py-2 text-gray-700">{so.customer_name}</td>
								<td class="px-4 py-2 text-gray-800">{so.job_name}</td>
								<td class="px-4 py-2 text-gray-600">{fmtDate(so.ship_date)}</td>
								<td class="px-4 py-2">
									<span class={statusBadge(so.status)}
										>{statusLabel(so.status)}</span
									>
								</td>
								<td class="px-4 py-2 text-right text-gray-500">{so.line_count}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="card-body text-gray-400 text-sm">No sales orders found.</div>
			{/if}
		{:else if data.sos.length}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">SO #</th>
						<th class="px-4 py-2 text-left text-gray-600">Customer</th>
						<th class="px-4 py-2 text-left text-gray-600">Job Name</th>
						<th class="px-4 py-2 text-left text-gray-600">Ship Date</th>
						<th class="px-4 py-2 text-left text-gray-600">Status</th>
						<th class="px-4 py-2 text-right text-gray-600">Lines</th>
					</tr>
				</thead>
				<tbody>
					{#each data.sos as so (so.id)}
						<tr class="border-b border-gray-50 hover:bg-gray-50">
							<td class="px-4 py-2">
								<a
									href="/so/{so.id}"
									class="font-medium text-blue-700 hover:underline"
									>{so.so_number}</a
								>
							</td>
							<td class="px-4 py-2 text-gray-700">{so.customer_name}</td>
							<td class="px-4 py-2 text-gray-800">{so.job_name}</td>
							<td class="px-4 py-2 text-gray-600">{fmtDate(so.ship_date)}</td>
							<td class="px-4 py-2">
								{#if so.status === 'OPEN'}<span class="badge-blue">Open</span>
								{:else if so.status === 'IN_PROGRESS'}<span class="badge-amber"
										>In Progress</span
									>
								{:else}<span class="badge-green">{so.status}</span>{/if}
							</td>
							<td class="px-4 py-2 text-right text-gray-500">{so.line_count}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">No open sales orders.</div>
		{/if}
	</div>
</main>
