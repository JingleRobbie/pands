<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { pathWithSearch, withReturnTo } from '$lib/navigation.js';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();
	const returnTo = $derived(pathWithSearch(page.url));
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
		{#if data.user?.role === 'admin'}
			<a href="/po/import" class="btn-secondary btn-sm">Import</a>
		{/if}
		<a href="/po/new" class="btn-primary btn-sm">+ New PO</a>
	</div>
</header>
<main class="p-6 space-y-4">
	<div class="flex items-center justify-between gap-4">
		<nav class="flex gap-1">
			<a href="/po" class={tabClass('')}>Active</a>
			<a href="/po?status=open" class={tabClass('open')}>Open</a>
			<a href="/po?status=cancelled" class={tabClass('cancelled')}>Cancelled</a>
			<a href="/po?status=all" class={tabClass('all')}>All</a>
		</nav>
		{#if data.status}
			<form method="GET" class="flex items-end gap-2">
				<input type="hidden" name="status" value={data.status} />
				{#if data.q}
					<input type="hidden" name="q" value={data.q} />
				{/if}
				<div>
					<label for="from" class="form-label">
						{data.status === 'open' || data.status === 'cancelled'
							? 'Expected From'
							: 'Activity From'}
					</label>
					<input id="from" name="from" type="date" class="form-input" value={data.from} />
				</div>
				<button type="submit" class="btn-secondary">Apply</button>
			</form>
		{/if}
	</div>

	{#if data.searchResults !== null}
		<div class="card overflow-x-auto">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">
					{data.searchResults.length} result{data.searchResults.length === 1 ? '' : 's'}
				</span>
			</div>
			{#if data.searchResults.length}
				<table class="dense-list-table min-w-[42rem]">
					<thead>
						<tr>
							<th class="text-left">PO #</th>
							<th class="text-left">Vendor</th>
							<th class="text-left">Expected / Received</th>
							<th class="text-left">Status</th>
							<th class="text-left">SKUs / Sq Ft</th>
						</tr>
					</thead>
					<tbody>
						{#each data.searchResults as po (po.id)}
							<tr
								class="cursor-pointer"
								onclick={() => goto(withReturnTo(`/po/${po.id}`, returnTo))}
							>
								<td class="font-medium text-gray-900">{po.po_number}</td>
								<td class="text-gray-700">{po.vendor_name}</td>
								<td>
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
								<td>
									<span class={statusBadge(po.status)}
										>{statusLabel(po.status)}</span
									>
								</td>
								<td>
									<div class="dense-list-lines">
										{#each po.lines ?? [] as line (line.sku_code)}
											<div class="dense-list-line">
												<span>{line.sku_code}</span>
												<span class="text-right font-mono tabular-nums"
													>{fmtSqft(line.sqft_ordered)}</span
												>
											</div>
										{/each}
									</div>
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
		<div class="card overflow-x-auto">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Active</span>
			</div>
			{#if data.overdue.length || data.upcoming.length}
				<table class="dense-list-table min-w-[42rem]">
					<thead>
						<tr>
							<th class="text-left">PO #</th>
							<th class="text-left">Vendor</th>
							<th class="text-left">Expected / Received</th>
							<th class="text-left">Status</th>
							<th class="text-left">SKUs / Sq Ft</th>
						</tr>
					</thead>
					<tbody>
						{#each data.overdue as po (po.id)}
							<tr
								class="dense-list-row-overdue cursor-pointer"
								onclick={() => goto(withReturnTo(`/po/${po.id}`, returnTo))}
							>
								<td class="font-medium text-gray-900">{po.po_number}</td>
								<td class="text-gray-700">{po.vendor_name}</td>
								<td class="text-amber-700 font-medium"
									>{fmtDate(po.expected_date)}</td
								>
								<td>
									<span class="badge-amber">Overdue</span>
								</td>
								<td>
									<div class="dense-list-lines">
										{#each po.lines ?? [] as line (line.sku_code)}
											<div class="dense-list-line">
												<span>{line.sku_code}</span>
												<span class="text-right font-mono tabular-nums"
													>{fmtSqft(line.sqft_ordered)}</span
												>
											</div>
										{/each}
									</div>
								</td>
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
								onclick={() => goto(withReturnTo(`/po/${po.id}`, returnTo))}
							>
								<td class="font-medium text-gray-900">{po.po_number}</td>
								<td class="text-gray-700">{po.vendor_name}</td>
								<td>
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
								<td>
									<span class={statusBadge(po.status)}
										>{statusLabel(po.status)}</span
									>
								</td>
								<td>
									<div class="dense-list-lines">
										{#each po.lines ?? [] as line (line.sku_code)}
											<div class="dense-list-line">
												<span>{line.sku_code}</span>
												<span class="text-right font-mono tabular-nums"
													>{fmtSqft(line.sqft_ordered)}</span
												>
											</div>
										{/each}
									</div>
								</td>
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
