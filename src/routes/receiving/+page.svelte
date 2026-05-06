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

	<div class="card overflow-x-auto">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">
				{data.status === 'open' ? 'Open POs' : `${data.pos.length} purchase orders`}
			</span>
		</div>
		{#if data.status !== 'open' && data.pos.length}
			<table class="dense-list-table min-w-[42rem]">
				<thead>
					<tr>
						<th class="text-left">PO #</th>
						<th class="text-left">Vendor</th>
						<th class="text-left">Expected</th>
						<th class="text-left">Received</th>
						<th class="text-left">Status</th>
						<th class="text-right">Open Lines</th>
					</tr>
				</thead>
				<tbody>
					{#each data.pos as po (po.id)}
						<tr
							class="cursor-pointer"
							onclick={() =>
								goto(
									po.status === 'OPEN'
										? withReturnTo(`/receiving/${po.id}`, returnTo)
										: withReturnTo(`/po/${po.id}`, returnTo)
								)}
						>
							<td class="font-medium text-gray-900">{po.po_number}</td>
							<td class="text-gray-700">{po.vendor_name}</td>
							<td class="text-gray-600">{fmtDate(po.expected_date)}</td>
							<td class="text-gray-600">{fmtDate(po.received_at)}</td>
							<td>
								<span class={statusBadge(po.status)}>{po.status}</span>
							</td>
							<td class="text-right tabular-nums text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else if data.status === 'open' && (data.overdue.length || data.upcoming.length)}
			<table class="dense-list-table min-w-[38rem]">
				<thead>
					<tr>
						<th class="text-left">PO #</th>
						<th class="text-left">Vendor</th>
						<th class="text-left">Expected</th>
						<th class="text-left">Status</th>
						<th class="text-right">Open Lines</th>
					</tr>
				</thead>
				<tbody>
					{#each data.overdue as po (po.id)}
						<tr
							class="dense-list-row-overdue cursor-pointer"
							onclick={() => goto(withReturnTo(`/receiving/${po.id}`, returnTo))}
						>
							<td class="font-medium text-gray-900">{po.po_number}</td>
							<td class="text-gray-700">{po.vendor_name}</td>
							<td class="text-amber-700 font-medium">{fmtDate(po.expected_date)}</td>
							<td><span class="badge-amber">Overdue</span></td>
							<td class="text-right tabular-nums text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}

					{#if data.overdue.length && data.upcoming.length}
						<tr class="dense-list-section-row">
							<td colspan="5">
								<span class="dense-list-section-label">Upcoming</span>
							</td>
						</tr>
					{/if}

					{#each data.upcoming as po (po.id)}
						<tr
							class="cursor-pointer"
							onclick={() => goto(withReturnTo(`/receiving/${po.id}`, returnTo))}
						>
							<td class="font-medium text-gray-900">{po.po_number}</td>
							<td class="text-gray-700">{po.vendor_name}</td>
							<td class="text-gray-600">{fmtDate(po.expected_date)}</td>
							<td><span class="badge-blue">Open</span></td>
							<td class="text-right tabular-nums text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">Nothing to receive.</div>
		{/if}
	</div>
</main>
