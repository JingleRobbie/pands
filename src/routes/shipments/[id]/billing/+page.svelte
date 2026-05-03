<script>
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();
	const shipment = $derived(data.shipment);
	const skuLines = $derived(data.skuLines);

	const totalSqft = $derived(skuLines.reduce((s, l) => s + l.sqft, 0));
</script>

<svelte:head>
	<title>Billing Summary {shipment.shipment_number} — PandS</title>
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
		<a href="/shipments/{shipment.id}" class="text-gray-400 hover:text-gray-600 text-sm"
			>← Packing Slip</a
		>
		<span class="font-semibold text-gray-800">Billing Summary</span>
	</div>
	<button onclick={() => window.print()} class="btn-secondary btn-sm">Print</button>
</div>

<div class="p-8 max-w-3xl mx-auto">
	<div class="flex justify-between items-start mb-8">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Billing Summary</h1>
			<p class="text-gray-500 text-sm mt-1">WO #{shipment.so_number} · {shipment.job_name}</p>
		</div>
		<div class="text-right">
			<p class="text-lg font-semibold text-gray-800">{shipment.shipment_number}</p>
			<p class="text-sm text-gray-500">Ship Date: {fmtDate(shipment.ship_date)}</p>
		</div>
	</div>

	<div class="mb-8 text-sm">
		<p class="font-medium text-gray-500 uppercase tracking-wide text-xs mb-1">Customer</p>
		<p class="font-semibold text-gray-900">{shipment.customer_name}</p>
		{#if shipment.customer_phone}
			<p class="text-gray-600">{shipment.customer_phone}</p>
		{/if}
	</div>

	<table class="w-full text-sm border border-gray-200">
		<thead>
			<tr class="bg-gray-100">
				<th class="px-4 py-2 text-left font-semibold text-gray-700 border-b border-gray-200"
					>Product</th
				>
				<th
					class="px-4 py-2 text-right font-semibold text-gray-700 border-b border-gray-200"
					>Sq Ft</th
				>
			</tr>
		</thead>
		<tbody>
			{#each skuLines as line, i (i)}
				<tr class="border-b border-gray-100">
					<td class="px-4 py-2 text-gray-700">{line.display_label}</td>
					<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
						>{fmtSqft(line.sqft)}</td
					>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="bg-gray-50 font-semibold">
				<td class="px-4 py-2 text-gray-700">Total</td>
				<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-800"
					>{fmtSqft(totalSqft)}</td
				>
			</tr>
		</tfoot>
	</table>
</div>
