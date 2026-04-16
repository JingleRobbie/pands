<script>
	import { goto } from '$app/navigation';
	import { fmtDate } from '$lib/utils.js';
	let { data } = $props();
</script>

<svelte:head><title>Receiving — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Receiving</h1>
</header>
<main class="p-6">
	<div class="card">
		<div class="card-header">
			<span class="text-sm font-semibold text-gray-700">Open POs</span>
		</div>
		{#if data.pos.length}
			<table class="w-full text-sm list-table">
				<thead>
					<tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">PO #</th>
						<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
						<th class="px-4 py-2 text-left text-gray-600">Expected</th>
						<th class="px-4 py-2 text-left text-gray-600">Open Lines</th>
					</tr>
				</thead>
				<tbody>
					{#each data.pos as po (po.id)}
						<tr
							class="border-b border-gray-100 cursor-pointer"
							onclick={() => goto(`/receiving/${po.id}`)}
						>
							<td class="px-4 py-2 font-medium">
								<a href="/receiving/{po.id}" class="text-blue-700 hover:underline"
									>{po.po_number}</a
								>
							</td>
							<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
							<td class="px-4 py-2 text-gray-600">{fmtDate(po.expected_date)}</td>
							<td class="px-4 py-2 text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">Nothing to receive.</div>
		{/if}
	</div>
</main>
