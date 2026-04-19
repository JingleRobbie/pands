<script>
	import { goto } from '$app/navigation';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();

	function statusBadge(s) {
		if (s === 'OPEN') return 'badge-blue';
		if (s === 'COMPLETE') return 'badge-green';
		if (s === 'CANCELLED') return 'badge-gray';
		return 'badge-gray';
	}
	function statusLabel(s) {
		return s.charAt(0) + s.slice(1).toLowerCase();
	}
</script>

<svelte:head><title>Work Orders — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Work Orders</h1>
	{#if data.user?.role === 'admin'}
		<a href="/wo/import" class="btn-primary btn-sm">Import CSV</a>
	{/if}
</header>
<main class="p-6">
	<div class="card">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">
				{data.wos.length} work order{data.wos.length === 1 ? '' : 's'}
			</span>
		</div>
		{#if data.wos.length}
			<table class="w-full text-sm list-table">
				<thead>
					<tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">SO #</th>
						<th class="px-4 py-2 text-left text-gray-600">Customer</th>
						<th class="px-4 py-2 text-left text-gray-600">Job</th>
						<th class="px-4 py-2 text-left text-gray-600">Branch</th>
						<th class="px-4 py-2 text-left text-gray-600">Ship Date</th>
						<th class="px-4 py-2 text-left text-gray-600">Facing</th>
						<th class="px-4 py-2 text-right text-gray-600">Lines</th>
						<th class="px-4 py-2 text-right text-gray-600">Sq Ft</th>
						<th class="px-4 py-2 text-left text-gray-600">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.wos as wo (wo.id)}
						<tr
							class="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
							onclick={() => goto(`/wo/${wo.id}`)}
						>
							<td class="px-4 py-2 font-medium text-gray-900">{wo.so_number}</td>
							<td class="px-4 py-2 text-gray-700">{wo.customer_name}</td>
							<td class="px-4 py-2 text-gray-700">{wo.job_name}</td>
							<td class="px-4 py-2 text-gray-500">{wo.branch}</td>
							<td class="px-4 py-2 text-gray-600">{fmtDate(wo.ship_date)}</td>
							<td class="px-4 py-2 text-gray-500">{wo.facing}</td>
							<td class="px-4 py-2 text-right text-gray-500">{wo.line_count}</td>
							<td class="px-4 py-2 text-right font-mono text-gray-600"
								>{fmtSqft(wo.total_sqft)}</td
							>
							<td class="px-4 py-2">
								<span class={statusBadge(wo.status)}>{statusLabel(wo.status)}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">
				No work orders found. <a href="/wo/import" class="text-blue-600 hover:underline"
					>Import a CSV</a
				> to get started.
			</div>
		{/if}
	</div>
</main>
