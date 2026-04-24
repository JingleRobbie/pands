<script>
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();
	const { shipment } = data;

	const totalRolls = shipment.lines.reduce((s, l) => s + l.rolls, 0);
	const totalSqft = shipment.lines.reduce((s, l) => s + l.sqft, 0);

	let dismissed = $state(false);
	const showCreated = $derived(data.justCreated && !dismissed);
	const showShipped = $derived(data.justShipped && !dismissed);
</script>

<svelte:head>
	<title>Shipment {shipment.shipment_number} — PandS</title>
	<style>
		@media print {
			.no-print {
				display: none !important;
			}
			body {
				font-size: 12px;
			}
		}
	</style>
</svelte:head>

<div class="no-print bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<a href="/shipments" class="text-gray-400 hover:text-gray-600 text-sm">← Shipments</a>
		<span class="font-semibold text-gray-800">{shipment.shipment_number}</span>
		<span class="badge-{shipment.status === 'SHIPPED' ? 'green' : 'amber'}"
			>{shipment.status}</span
		>
	</div>
	<div class="flex items-center gap-2">
		<a href="/shipments/{shipment.id}/billing" class="btn-secondary btn-sm">Billing Summary</a>
		{#if shipment.status === 'DRAFT'}
			<a href="/shipments/{shipment.id}/edit" class="btn-secondary btn-sm">Edit</a>
			<a href="/shipments/{shipment.id}/ship" class="btn-primary btn-sm">Mark Shipped</a>
		{/if}
		<button onclick={() => window.print()} class="btn-secondary btn-sm">Print</button>
	</div>
</div>

{#if showCreated}
	<div
		class="no-print mb-0 mx-6 mt-3 px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200 flex items-center justify-between"
	>
		<span>Shipment {shipment.shipment_number} created as DRAFT.</span>
		<button
			type="button"
			class="text-green-700 hover:text-green-900 leading-none"
			onclick={() => (dismissed = true)}>×</button
		>
	</div>
{/if}
{#if showShipped}
	<div
		class="no-print mb-0 mx-6 mt-3 px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200 flex items-center justify-between"
	>
		<span>Shipment {shipment.shipment_number} marked as SHIPPED.</span>
		<button
			type="button"
			class="text-green-700 hover:text-green-900 leading-none"
			onclick={() => (dismissed = true)}>×</button
		>
	</div>
{/if}

<div class="p-8 max-w-4xl mx-auto">
	<div class="flex justify-between items-start mb-8">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Packing Slip</h1>
			<p class="text-gray-500 text-sm mt-1">WO #{shipment.so_number} · {shipment.job_name}</p>
		</div>
		<div class="text-right">
			<p class="text-lg font-semibold text-gray-800">{shipment.shipment_number}</p>
			<p class="text-sm text-gray-500">Ship Date: {fmtDate(shipment.ship_date)}</p>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-8 mb-8 text-sm">
		<div>
			<p class="font-medium text-gray-500 uppercase tracking-wide text-xs mb-1">Customer</p>
			<p class="font-semibold text-gray-900">{shipment.customer_name}</p>
			{#if shipment.customer_phone}
				<p class="text-gray-600">{shipment.customer_phone}</p>
			{/if}
		</div>
		<div>
			<p class="font-medium text-gray-500 uppercase tracking-wide text-xs mb-1">Branch</p>
			<p class="text-gray-700">{shipment.branch || '—'}</p>
		</div>
	</div>

	<table class="w-full text-sm border border-gray-200">
		<thead>
			<tr class="bg-gray-100">
				<th class="px-4 py-2 text-left font-semibold text-gray-700 border-b border-gray-200"
					>SKU</th
				>
				<th
					class="px-4 py-2 text-right font-semibold text-gray-700 border-b border-gray-200"
					>Rolls</th
				>
				<th
					class="px-4 py-2 text-right font-semibold text-gray-700 border-b border-gray-200"
					>Sq Ft</th
				>
			</tr>
		</thead>
		<tbody>
			{#each shipment.lines as line (line.id)}
				<tr class="border-b border-gray-100">
					<td class="px-4 py-2 text-gray-700">{line.display_label}</td>
					<td class="px-4 py-2 text-right tabular-nums text-gray-600">{line.rolls}</td>
					<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
						>{fmtSqft(line.sqft)}</td
					>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="bg-gray-50 font-semibold">
				<td colspan="2" class="px-4 py-2 text-gray-700">Total</td>
				<td class="px-4 py-2 text-right tabular-nums text-gray-800">{totalRolls}</td>
				<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-800"
					>{fmtSqft(totalSqft)}</td
				>
			</tr>
		</tfoot>
	</table>
</div>
