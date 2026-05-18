<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { pathWithSearch, withReturnTo } from '$lib/navigation.js';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();
	const returnTo = $derived(pathWithSearch(page.url));

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

<svelte:head><title>Work Orders - PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Work Orders</h1>
	{#if data.user?.role === 'admin'}
		<a href="/wo/import" class="btn-primary btn-sm">Import</a>
	{/if}
</header>
<main class="p-6 space-y-4">
	<div class="flex items-center justify-between gap-4">
		<nav class="flex gap-1">
			<a href="/wo" class={tabClass('open')}>Open</a>
			<a href="/wo?status=complete" class={tabClass('complete')}>Complete</a>
			<a href="/wo?status=all" class={tabClass('all')}>All</a>
		</nav>
		{#if data.status !== 'open'}
			<form method="GET" class="flex items-end gap-2">
				<input type="hidden" name="status" value={data.status} />
				<div>
					<label for="from" class="form-label">
						{data.status === 'complete' ? 'Completed From' : 'Activity From'}
					</label>
					<input id="from" name="from" type="date" class="form-input" value={data.from} />
				</div>
				<button type="submit" class="btn-secondary">Apply</button>
			</form>
		{/if}
	</div>

	<div class="card overflow-x-auto">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">
				{data.wos.length} work order{data.wos.length === 1 ? '' : 's'}
			</span>
		</div>
		{#if data.wos.length}
			<table class="dense-list-table min-w-[56rem]">
				<thead>
					<tr>
						<th class="text-left">SO #</th>
						<th class="text-left">Customer</th>
						<th class="text-left">Job</th>
						<th class="text-left">Branch</th>
						<th class="text-left">Ship Date</th>
						{#if data.status !== 'open'}
							<th class="text-left">Completed</th>
						{/if}
						<th class="text-right">Lines</th>
						<th class="text-right">Sq Ft</th>
						<th class="text-right">
							<span
								class="relative inline-flex items-center gap-1 group cursor-default"
							>
								Progress
								<span class="text-gray-400 text-xs">ⓘ</span>
								<span
									class="pointer-events-none absolute right-0 top-5 z-20 hidden group-hover:block w-52 rounded bg-gray-800 p-2.5 text-left text-xs text-white shadow-lg leading-relaxed font-normal"
								>
									<span class="text-green-400 font-bold">N</span> / total -
									produced / total<br />
									<span class="text-blue-400 font-bold">+N</span> - scheduled
								</span>
							</span>
						</th>
						<th class="text-left">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.wos as wo (wo.id)}
						<tr
							class="cursor-pointer"
							onclick={() => goto(withReturnTo(`/wo/${wo.id}`, returnTo))}
						>
							<td class="font-medium text-gray-900">{wo.so_number}</td>
							<td class="text-gray-700">{wo.customer_name}</td>
							<td class="text-gray-700">
								{wo.job_name}
								{#if wo.has_branched}
									<span class="badge-blue ml-1 text-xs">Cut-Down Setup</span>
								{/if}
							</td>
							<td class="text-gray-500">{wo.branch}</td>
							<td class="text-gray-600">
								{#if wo.ship_asap}<span class="badge-red">ASAP</span>{:else}{fmtDate(wo.ship_date) || '-'}{/if}
							</td>
							{#if data.status !== 'open'}
								<td class="text-gray-600">{fmtDate(wo.completed_at)}</td>
							{/if}
							<td class="text-right text-gray-500">{wo.line_count}</td>
							<td class="text-right font-mono text-gray-600"
								>{fmtSqft(wo.total_sqft)}</td
							>
							<td class="text-right tabular-nums">
								<span class="text-green-600 font-medium">{wo.rolls_produced}</span
								><span class="text-gray-400"> / {wo.total_rolls} rolls</span>
								{#if wo.rolls_scheduled > 0}
									<div class="text-xs text-blue-500">
										+{wo.rolls_scheduled} production scheduled
									</div>
								{/if}
							</td>
							<td>
								<span class={statusBadge(wo.status)}>{statusLabel(wo.status)}</span>
								{#if wo.has_stale}
									<a
										href="/wo/{wo.id}/diff"
										class="badge-amber ml-1 text-xs"
										onclick={(e) => e.stopPropagation()}>Needs Review</a
									>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">
				No work orders found. <a href="/wo/import" class="text-blue-600 hover:underline"
					>Import a work order</a
				> to get started.
			</div>
		{/if}
	</div>
</main>
