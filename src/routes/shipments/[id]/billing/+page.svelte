<script>
	import { page } from '$app/state';
	import { getReturnTo, withReturnTo } from '$lib/navigation.js';
	import { fmtDate, fmtSqft, skuLabel } from '$lib/utils.js';
	let { data } = $props();
	const shipment = $derived(data.shipment);
	const skuLines = $derived(data.skuLines);
	const returnTo = $derived(getReturnTo(page.url, '/shipments'));
	const shipmentHref = $derived(withReturnTo(`/shipments/${shipment.id}`, returnTo));

	const totalSqft = $derived(skuLines.reduce((s, l) => s + l.sqft, 0));
</script>

<svelte:head>
	<title>Billing Summary {shipment.shipment_number} — PandS</title>
</svelte:head>

<div class="no-print page-header px-6 py-3 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<a href={shipmentHref} class="text-gray-400 hover:text-gray-600 text-sm">← Packing Slip</a>
		<span class="font-semibold text-gray-800">Billing Summary</span>
	</div>
	<button onclick={() => window.print()} class="btn-secondary btn-sm">Print</button>
</div>

<div class="slip-canvas">
<div class="slip-paper">
	<div class="flex justify-between items-start mb-8">
		<div>
			<h1 class="text-2xl font-bold">Billing Summary</h1>
			<p class="text-sm mt-1" style="color:#555">WO #{shipment.so_number} · {shipment.job_name}</p>
		</div>
		<div class="text-right">
			<p class="text-lg font-semibold">{shipment.shipment_number}</p>
			<p class="text-sm" style="color:#555">Ship Date: {fmtDate(shipment.ship_date)}</p>
		</div>
	</div>

	<div class="mb-8 text-sm">
		<p style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:2px">Customer</p>
		<p style="font-weight:700;font-size:13pt">{shipment.customer_name}</p>
		{#if shipment.customer_phone}
			<p style="color:#555">{shipment.customer_phone}</p>
		{/if}
	</div>

	<table class="w-full text-sm border border-gray-200">
		<thead>
			<tr>
				<th class="px-4 py-2 text-left">Product</th>
				<th class="px-4 py-2 text-right">Sq Ft</th>
			</tr>
		</thead>
		<tbody>
			{#each skuLines as line, i (i)}
				<tr>
					<td class="px-4 py-2">{skuLabel(line.display_label, line.pebs)}</td>
					<td class="px-4 py-2 text-right tabular-nums font-mono">{fmtSqft(line.sqft)}</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<td class="px-4 py-2 font-semibold">Total</td>
				<td class="px-4 py-2 text-right tabular-nums font-mono font-semibold">{fmtSqft(totalSqft)}</td>
			</tr>
		</tfoot>
	</table>
</div>
</div>

<style>
	.slip-canvas {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		background: #94a3b8;
		padding: 2rem 1rem;
		min-height: 100%;
	}
	:global(.dark) .slip-canvas {
		background: #1e293b;
	}
	.slip-paper {
		width: 8.5in;
		background: white !important;
		color: #000 !important;
		padding: 0.75in;
		box-shadow:
			0 4px 24px rgba(0, 0, 0, 0.18),
			0 1px 4px rgba(0, 0, 0, 0.1);
	}
	:global(.slip-paper) * {
		color: #000 !important;
		background-color: white !important;
	}
	:global(.slip-paper) table {
		border-color: #999 !important;
	}
	:global(.slip-paper) th {
		font-size: 15px !important;
		font-weight: 700 !important;
		border-bottom: 2px solid #000 !important;
		border-color: #999 !important;
	}
	:global(.slip-paper) td {
		border-color: #ddd !important;
	}
	:global(.slip-paper) tfoot td {
		border-top: 1.5px solid #000 !important;
	}
	@media print {
		.slip-canvas {
			background: transparent;
			padding: 0;
			display: block;
		}
		.slip-paper {
			width: 100%;
			padding: 0;
			box-shadow: none;
		}
	}
</style>
