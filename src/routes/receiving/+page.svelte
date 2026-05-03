<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { pathWithSearch, withReturnTo } from '$lib/navigation.js';
	import { fmtDate } from '$lib/utils.js';
	let { data } = $props();
	const returnTo = $derived(pathWithSearch(page.url));

	function tabClass(val) {
		return data.status === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}

	function statusBadge(status) {
		if (status === 'RECEIVED') return 'badge-green';
		if (status === 'OPEN') return 'badge-blue';
		if (status === 'CANCELLED') return 'badge-gray';
		return 'badge-gray';
	}
</script>

<svelte:head><title>Receiving — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Receiving</h1>
</header>
<main class="p-6 space-y-4">
	<div class="flex items-center justify-between gap-4">
		<nav class="flex gap-1">
			<a href="/receiving" class={tabClass('open')}>Open</a>
			<a href="/receiving?status=received" class={tabClass('received')}>Received</a>
			<a href="/receiving?status=all" class={tabClass('all')}>All</a>
		</nav>
		{#if data.status !== 'open'}
			<form method="GET" class="flex items-end gap-2">
				<input type="hidden" name="status" value={data.status} />
				<div>
					<label for="from" class="form-label"
						>{data.status === 'received' ? 'Received From' : 'Activity From'}</label
					>
					<input id="from" name="from" type="date" class="form-input" value={data.from} />
				</div>
				<button type="submit" class="btn-secondary">Apply</button>
			</form>
		{/if}
	</div>

	<div class="card">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">
				{data.status === 'open' ? 'Open POs' : `${data.pos.length} purchase orders`}
			</span>
		</div>
		{#if data.status !== 'open' && data.pos.length}
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500">PO #</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Expected</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Received</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Status</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Open Lines</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each data.pos as po (po.id)}
						<tr
							class="hover:bg-gray-50 cursor-pointer"
							onclick={() =>
								goto(
									po.status === 'OPEN'
										? withReturnTo(`/receiving/${po.id}`, returnTo)
										: withReturnTo(`/po/${po.id}`, returnTo)
								)}
						>
							<td class="px-4 py-3 font-medium text-gray-900">{po.po_number}</td>
							<td class="px-4 py-3 text-gray-700">{po.vendor_name}</td>
							<td class="px-4 py-3 text-gray-600">{fmtDate(po.expected_date)}</td>
							<td class="px-4 py-3 text-gray-600">{fmtDate(po.received_at)}</td>
							<td class="px-4 py-3">
								<span class={statusBadge(po.status)}>{po.status}</span>
							</td>
							<td class="px-4 py-3 text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else if data.status === 'open' && (data.overdue.length || data.upcoming.length)}
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500">PO #</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Expected</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Status</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Open Lines</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each data.overdue as po (po.id)}
						<tr
							class="bg-amber-50 cursor-pointer border-l-2 border-l-amber-400 hover:bg-amber-100"
							onclick={() => goto(withReturnTo(`/receiving/${po.id}`, returnTo))}
						>
							<td class="px-4 py-3 font-medium text-gray-900">{po.po_number}</td>
							<td class="px-4 py-3 text-gray-700">{po.vendor_name}</td>
							<td class="px-4 py-3 text-amber-700 font-medium"
								>{fmtDate(po.expected_date)}</td
							>
							<td class="px-4 py-3"><span class="badge-amber">Overdue</span></td>
							<td class="px-4 py-3 text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}

					{#if data.overdue.length && data.upcoming.length}
						<tr>
							<td colspan="5" class="px-4 py-1 bg-gray-50 border-y border-gray-200">
								<span
									class="text-xs font-medium text-gray-400 uppercase tracking-wide"
									>Upcoming</span
								>
							</td>
						</tr>
					{/if}

					{#each data.upcoming as po (po.id)}
						<tr
							class="hover:bg-gray-50 cursor-pointer"
							onclick={() => goto(withReturnTo(`/receiving/${po.id}`, returnTo))}
						>
							<td class="px-4 py-3 font-medium text-gray-900">{po.po_number}</td>
							<td class="px-4 py-3 text-gray-700">{po.vendor_name}</td>
							<td class="px-4 py-3 text-gray-600">{fmtDate(po.expected_date)}</td>
							<td class="px-4 py-3"><span class="badge-blue">Open</span></td>
							<td class="px-4 py-3 text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">Nothing to receive.</div>
		{/if}
	</div>
</main>
