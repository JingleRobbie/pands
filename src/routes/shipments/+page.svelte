<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { pathWithSearch, withReturnTo } from '$lib/navigation.js';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();
	const returnTo = $derived(pathWithSearch(page.url));

	function tabClass(val) {
		return data.status === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}
</script>

<div class="p-6 space-y-4">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">Shipments</h1>
	</div>

	<div class="flex items-center justify-between gap-4">
		<nav class="flex gap-1">
			<a href="/shipments" class={tabClass('draft')}>Draft</a>
			<a href="/shipments?status=shipped" class={tabClass('shipped')}>Shipped</a>
			<a href="/shipments?status=all" class={tabClass('all')}>All</a>
		</nav>
		{#if data.status !== 'draft'}
			<form method="GET" class="flex items-end gap-2">
				<input type="hidden" name="status" value={data.status} />
				<div>
					<label for="from" class="form-label">Ship From</label>
					<input id="from" name="from" type="date" class="form-input" value={data.from} />
				</div>
				<button type="submit" class="btn-secondary">Apply</button>
			</form>
		{/if}
	</div>

	{#if data.shipments.length === 0}
		<p class="text-gray-500 text-sm">
			No {data.status === 'all' ? '' : data.status} shipments found.
		</p>
	{:else}
		<div class="card">
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Shipment #</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Job</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Ship Date</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Rolls</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Sq Ft</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each data.shipments as s (s.id)}
						<tr
							class="hover:bg-gray-50 cursor-pointer"
							onclick={() => goto(withReturnTo(`/shipments/${s.id}`, returnTo))}
						>
							<td class="px-4 py-3 font-medium text-gray-900">{s.shipment_number}</td>
							<td class="px-4 py-3 text-gray-700">{s.customer_name}</td>
							<td class="px-4 py-3 text-gray-600">{s.job_name}</td>
							<td class="px-4 py-3 text-gray-600">{fmtDate(s.ship_date)}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-600"
								>{s.total_rolls ?? 0}</td
							>
							<td class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
								>{fmtSqft(s.total_sqft ?? 0)}</td
							>
							<td class="px-4 py-3">
								<span class="badge-{s.status === 'SHIPPED' ? 'green' : 'amber'}"
									>{s.status}</span
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
