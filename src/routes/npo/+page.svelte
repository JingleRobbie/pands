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
	function tabClass(val) {
		return data.status === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}
</script>

<svelte:head><title>Non-Production Orders - PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Non-Production Orders</h1>
	<a href="/npo/new" class="btn-primary btn-sm">New NPO</a>
</header>

<main class="p-6 space-y-4">
	<div class="flex items-center justify-between gap-4">
		<nav class="flex gap-1">
			<a href="/npo" class={tabClass('open')}>Open</a>
			<a href="/npo?status=complete" class={tabClass('complete')}>Complete</a>
			<a href="/npo?status=all" class={tabClass('all')}>All</a>
		</nav>
		{#if data.status !== 'open'}
			<form method="GET" class="flex items-end gap-2">
				<input type="hidden" name="status" value={data.status} />
				<div>
					<label for="from" class="form-label">From</label>
					<input id="from" name="from" type="date" class="form-input" value={data.from} />
				</div>
				<button type="submit" class="btn-secondary">Apply</button>
			</form>
		{/if}
	</div>

	<div class="card overflow-x-auto">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">
				{data.npos.length} non-production order{data.npos.length === 1 ? '' : 's'}
			</span>
		</div>
		{#if data.npos.length}
			<table class="dense-list-table min-w-[44rem]">
				<thead>
					<tr>
						<th class="text-left">SO #</th>
						<th class="text-left">Customer</th>
						<th class="text-left">Job</th>
						<th class="text-left">Ship Date</th>
						<th class="text-right">Lines</th>
						<th class="text-right">Sq Ft</th>
						<th class="text-left">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.npos as npo (npo.id)}
						<tr class="cursor-pointer" onclick={() => goto(`/npo/${npo.id}`)}>
							<td class="font-medium text-gray-900">{npo.so_number}</td>
							<td class="text-gray-700">{npo.customer_name}</td>
							<td class="text-gray-700">{npo.job_name}</td>
							<td class="text-gray-600">
								{#if npo.ship_asap}<span class="badge-red">ASAP</span>{:else}{fmtDate(npo.ship_date) || '-'}{/if}
							</td>
							<td class="text-right text-gray-500">{npo.line_count}</td>
							<td class="text-right font-mono text-gray-600">{fmtSqft(npo.total_sqft)}</td>
							<td>
								<span class={statusBadge(npo.status)}>{statusLabel(npo.status)}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">
				No non-production orders found. <a href="/npo/new" class="text-blue-600 hover:underline">Create one</a> to get started.
			</div>
		{/if}
	</div>
</main>
