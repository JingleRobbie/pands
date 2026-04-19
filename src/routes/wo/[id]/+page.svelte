<script>
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();
	const { wo, lines } = data;

	const totalSqft = lines.reduce((s, l) => s + l.sqft, 0);
</script>

<svelte:head><title>WO {wo.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<a href="/wo" class="text-gray-400 hover:text-gray-600 text-sm">← Work Orders</a>
		<h1 class="text-lg font-semibold text-gray-900">SO #{wo.so_number}</h1>
	</div>
</header>

<main class="p-6 max-w-4xl space-y-4">
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Details</span>
		</div>
		<div class="card-body grid grid-cols-3 gap-4 text-sm">
			<div>
				<p class="form-label">Customer</p>
				<p class="text-gray-900">{wo.customer_name}</p>
			</div>
			<div>
				<p class="form-label">Job</p>
				<p class="text-gray-900">{wo.job_name}</p>
			</div>
			<div>
				<p class="form-label">Branch</p>
				<p class="text-gray-900">{wo.branch}</p>
			</div>
			<div>
				<p class="form-label">Ship Date</p>
				<p class="text-gray-900">{fmtDate(wo.ship_date)}</p>
			</div>
			<div>
				<p class="form-label">Total Sq Ft</p>
				<p class="text-gray-900 font-mono">{fmtSqft(totalSqft)}</p>
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700"
				>{lines.length} line{lines.length === 1 ? '' : 's'}</span
			>
		</div>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-gray-100 bg-gray-50">
					<th class="px-4 py-2 text-left text-gray-500 font-medium">SKU</th>
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Facing</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Qty</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Thickness</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Width</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Length</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Sq Ft</th>
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Roll For</th>
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Instructions</th>
				</tr>
			</thead>
			<tbody>
				{#each lines as line (line.id)}
					<tr class="border-b border-gray-100">
						<td class="px-4 py-2 font-medium text-gray-800">{line.display_label}</td>
						<td class="px-4 py-2 text-gray-500">{line.facing}</td>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums">{line.qty}</td>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{line.thickness_in}"</td
						>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{line.width_in}"</td
						>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{line.length_ft}'</td
						>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{fmtSqft(line.sqft)}</td
						>
						<td class="px-4 py-2 text-gray-500">{line.rollfor}</td>
						<td class="px-4 py-2 text-gray-400 italic text-xs">{line.instructions}</td>
					</tr>
				{/each}
				<tr class="border-t border-gray-200 bg-gray-50">
					<td colspan="5" class="px-4 py-2 text-sm text-gray-500 font-medium">Total</td>
					<td class="px-4 py-2 text-right font-mono font-medium text-gray-700"
						>{fmtSqft(totalSqft)}</td
					>
					<td colspan="3"></td>
				</tr>
			</tbody>
		</table>
	</div>
</main>
