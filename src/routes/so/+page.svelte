<script>
	let { data } = $props();
	function fmtDate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
</script>
<svelte:head><title>Sales Orders — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Sales Orders</h1>
	<a href="/so/new" class="btn-primary btn-sm">+ New SO</a>
</header>
<main class="p-6">
<div class="card">
	{#if data.sos.length}
	<table class="w-full text-sm">
		<thead><tr class="border-b border-gray-100">
			<th class="px-4 py-2 text-left text-gray-600">SO #</th>
			<th class="px-4 py-2 text-left text-gray-600">Job Name</th>
			<th class="px-4 py-2 text-left text-gray-600">Ship Date</th>
			<th class="px-4 py-2 text-left text-gray-600">Status</th>
			<th class="px-4 py-2 text-right text-gray-600">Lines</th>
		</tr></thead>
		<tbody>
		{#each data.sos as so}
		<tr class="border-b border-gray-50 hover:bg-gray-50">
			<td class="px-4 py-2"><a href="/so/{so.id}" class="font-medium text-blue-700 hover:underline">{so.so_number}</a></td>
			<td class="px-4 py-2 text-gray-800">{so.job_name}</td>
			<td class="px-4 py-2 text-gray-600">{fmtDate(so.ship_date)}</td>
			<td class="px-4 py-2">
				{#if so.status === 'OPEN'}<span class="badge-blue">Open</span>
				{:else if so.status === 'IN_PROGRESS'}<span class="badge-amber">In Progress</span>
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
