<script>
	import { fmtDate, fmtSqft, skuLabel } from '$lib/utils.js';
	let { data } = $props();
	const shipment = $derived(data.shipment);
	const totalRolls = $derived(shipment.lines.reduce((s, l) => s + l.rolls, 0));
	const totalSqft = $derived(shipment.lines.reduce((s, l) => s + l.sqft, 0));
</script>

<svelte:head>
	<title>Packing Slip {shipment.shipment_number}</title>
	<link rel="stylesheet" href="/css/app.css" />
</svelte:head>

<div class="slip-paper">
	<div class="flex justify-between items-start mb-8">
		<div>
			<h1 class="text-2xl font-bold">Packing Slip</h1>
			<p class="text-sm mt-1" style="color:#555">WO #{shipment.so_number} · {shipment.job_name}</p>
		</div>
		<div class="text-right">
			<p class="text-lg font-semibold">{shipment.shipment_number}</p>
			<p class="text-sm" style="color:#555">Ship Date: {fmtDate(shipment.ship_date)}</p>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-8 mb-8 text-sm">
		<div>
			<p style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:2px">Customer</p>
			<p style="font-weight:700">{shipment.customer_name}</p>
			{#if shipment.customer_phone}<p style="color:#555">{shipment.customer_phone}</p>{/if}
		</div>
		<div>
			<p style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:2px">Branch</p>
			<p>{shipment.branch || '—'}</p>
		</div>
	</div>

	<table class="w-full text-sm" style="border:1px solid #999;border-collapse:collapse">
		<thead>
			<tr>
				<th style="padding:6px 12px;text-align:right;font-weight:700;border-bottom:2px solid #000;font-size:13px">Rolls</th>
				<th style="padding:6px 12px;text-align:left;font-weight:700;border-bottom:2px solid #000;font-size:13px">Roll For</th>
				<th style="padding:6px 12px;text-align:left;font-weight:700;border-bottom:2px solid #000;font-size:13px">SKU</th>
				<th style="padding:6px 12px;text-align:right;font-weight:700;border-bottom:2px solid #000;font-size:13px">Length</th>
				<th style="padding:6px 12px;text-align:right;font-weight:700;border-bottom:2px solid #000;font-size:13px">Sq Ft</th>
			</tr>
		</thead>
		<tbody>
			{#each shipment.lines as line (line.id)}
				<tr style="border-bottom:1px solid #ddd">
					<td style="padding:6px 12px;text-align:right;font-family:monospace">{line.rolls}</td>
					<td style="padding:6px 12px">{line.rollfor ?? '—'}</td>
					<td style="padding:6px 12px">{skuLabel(line.display_label, line.pebs)}</td>
					<td style="padding:6px 12px;text-align:right;font-family:monospace">{line.length_ft} ft</td>
					<td style="padding:6px 12px;text-align:right;font-family:monospace">{fmtSqft(line.sqft)}</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr style="border-top:1.5px solid #000">
				<td colspan="3" style="padding:6px 12px;font-weight:600">Total</td>
				<td style="padding:6px 12px;text-align:right;font-family:monospace;font-weight:600">{totalRolls}</td>
				<td style="padding:6px 12px;text-align:right;font-family:monospace;font-weight:600">{fmtSqft(totalSqft)}</td>
			</tr>
		</tfoot>
	</table>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: white;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 12px;
		color: #000;
	}
	.slip-paper {
		padding: 0.75in;
	}
</style>
