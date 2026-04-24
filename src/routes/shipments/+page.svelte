<script>
	import { goto } from '$app/navigation';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();

	// TODO(human): Add filter state and derived values here.
	// You need three things:
	//   1. let showFullyShipped = $state(false)  — the toggle
	//   2. const visible = $derived(...)          — filtered list (all when toggled on, non-fully-shipped when off)
	//   3. const hiddenCount = $derived(...)      — count of hidden rows (for the header hint)
	// data.shipments is the full array; each row has a wo_fully_shipped boolean from the server.
	let showFullyShipped = $state(false);
	const visible = $derived(() => {
		return showFullyShipped ? data.shipments : data.shipments.filter((s) => !s.wo_fully_shipped);
	});
	const hiddenCount = $derived(() => {
		return data.shipments.length - visible.length;
	});
</script>

<div class="p-6">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">Shipments</h1>
		<!-- TODO(human): Add the toggle checkbox label here.
		     Use explicit for="show_shipped" + id="show_shipped".
		     Show "(N hidden)" hint only when showFullyShipped is false and hiddenCount > 0. -->
		<label for="show_shipped" class="flex items-center cursor-pointer">
			<input
				type="checkbox"
				id="show_shipped"
				class="mr-2 form-checkbox"
				checked={showFullyShipped}
				onchange={(e) => (showFullyShipped = e.target.checked)}
			/>
			<span class="text-sm font-medium text-gray-700">Show Fully Shipped</span>
		</label>
	</div>

	<!-- TODO(human): Replace the two branches below with three:
	     1. data.shipments.length === 0  → "No shipments yet."
	     2. visible.length === 0         → "All shipments are for fully-shipped work orders. Enable the toggle above to see them."
	     3. else                         → the card/table below, iterating {#each visible as s (s.id)}
	     Keep the (s.id) key on the each block. -->
	{#if data.shipments.length === 0}
		<p class="text-gray-500 text-sm">
			No shipments yet. Create one from a Work Order detail page.
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
							onclick={() => goto(`/shipments/${s.id}`)}
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
