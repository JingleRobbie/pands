<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { shipment } = data;

	const totalRolls = shipment.lines.reduce((s, l) => s + l.rolls, 0);
	const totalSqft = shipment.lines.reduce((s, l) => s + l.sqft, 0);
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
			<form method="POST" action="?/markShipped" use:enhance>
				<button type="submit" class="btn-primary btn-sm">Mark Shipped</button>
			</form>
		{/if}
		<button onclick={() => window.print()} class="btn-secondary btn-sm">Print</button>
	</div>
</div>

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
					>Run #</th
				>
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
					<td class="px-4 py-2 font-mono text-gray-700">{line.run_number}</td>
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
