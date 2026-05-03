<script>
	import { goto } from '$app/navigation';
	import { fmtDate } from '$lib/utils.js';
	let { data } = $props();
	const counts = $derived(data.counts);
</script>

<svelte:head><title>Inventory Counts — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<a href="/matrix" class="text-gray-400 hover:text-gray-600 text-sm">← Overview</a>
		<h1 class="text-lg font-semibold text-gray-900">Inventory Counts</h1>
	</div>
	<a href="/inventory/count" class="btn-primary btn-sm">+ Record Count</a>
</header>

<main class="p-6 max-w-3xl">
	<div class="card">
		{#if counts.length === 0}
			<div class="card-body text-sm text-gray-400">No inventory counts recorded yet.</div>
		{:else}
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Date</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Recorded By</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Memo</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">SKUs Adjusted</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each counts as count (count.id)}
						<tr
							class="hover:bg-gray-50 cursor-pointer"
							onclick={() => goto(`/inventory/counts/${count.id}`)}
						>
							<td class="px-4 py-3 text-gray-900 font-medium tabular-nums"
								>{fmtDate(count.count_date)}</td
							>
							<td class="px-4 py-3 text-gray-600">{count.created_by_name}</td>
							<td class="px-4 py-3 text-gray-600">{count.memo || '—'}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-600"
								>{count.sku_count}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</main>
