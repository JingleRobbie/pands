<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { count, lines } = data;
	let confirming = $state(false);
</script>

<svelte:head><title>Count {fmtDate(count.count_date)} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<a href="/inventory/counts" class="text-gray-400 hover:text-gray-600 text-sm">← Counts</a>
		<h1 class="text-lg font-semibold text-gray-900">Count — {fmtDate(count.count_date)}</h1>
	</div>
	<button onclick={() => (confirming = true)} class="btn-danger btn-sm">Delete</button>
</header>

<main class="p-6 max-w-2xl space-y-6">
	{#if form?.error}
		<p class="text-red-600 text-sm">{form.error}</p>
	{/if}
	<div class="card">
		<div class="card-body grid grid-cols-3 gap-4 text-sm">
			<div>
				<p class="form-label">Count Date</p>
				<p class="text-gray-900">{fmtDate(count.count_date)}</p>
			</div>
			<div>
				<p class="form-label">Recorded By</p>
				<p class="text-gray-900">{count.created_by_name}</p>
			</div>
			<div>
				<p class="form-label">Recorded At</p>
				<p class="text-gray-900">{new Date(count.created_at).toLocaleString()}</p>
			</div>
			{#if count.memo}
				<div class="col-span-3">
					<p class="form-label">Memo</p>
					<p class="text-gray-900">{count.memo}</p>
				</div>
			{/if}
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700"
				>{lines.length} SKU{lines.length === 1 ? '' : 's'} adjusted</span
			>
		</div>
		<table class="min-w-full divide-y divide-gray-200 text-sm">
			<thead class="bg-gray-50">
				<tr>
					<th class="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
					<th class="px-4 py-3 text-right font-medium text-gray-500">Counted Sq Ft</th>
					<th class="px-4 py-3 text-right font-medium text-gray-500">Adjustment</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100 bg-white">
				{#each lines as line, i (i)}
					<tr>
						<td class="px-4 py-3 font-medium text-gray-900">{line.display_label}</td>
						<td class="px-4 py-3 text-right tabular-nums font-mono text-gray-700">
							{line.counted_sqft != null ? fmtSqft(line.counted_sqft) : '—'}
						</td>
						<td class="px-4 py-3 text-right tabular-nums font-mono font-medium">
							{#if line.transaction_type === 'ADJUSTMENT_IN'}
								<span class="text-green-600">+{fmtSqft(line.sqft_quantity)}</span>
							{:else}
								<span class="text-red-600">−{fmtSqft(line.sqft_quantity)}</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>

{#if confirming}
	<div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
			<h2 class="text-base font-semibold text-gray-900">Delete this count?</h2>
			<p class="text-sm text-gray-600">
				This will permanently remove the <strong>{fmtDate(count.count_date)}</strong> count
				and reverse all {lines.length} adjustment{lines.length === 1 ? '' : 's'}. This
				cannot be undone.
			</p>
			<div class="flex gap-3">
				<form method="POST" action="?/delete" use:enhance>
					<button type="submit" class="btn-danger btn-sm">Yes, delete</button>
				</form>
				<button onclick={() => (confirming = false)} class="btn-secondary btn-sm"
					>Cancel</button
				>
			</div>
		</div>
	</div>
{/if}
