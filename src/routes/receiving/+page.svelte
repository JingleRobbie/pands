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
		{#if data.overdue.length || data.upcoming.length}
			<table class="w-full text-sm list-table">
				<thead>
					<tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">PO #</th>
						<th class="px-4 py-2 text-left text-gray-600">Vendor</th>
						<th class="px-4 py-2 text-left text-gray-600">Expected</th>
						<th class="px-4 py-2 text-left text-gray-600">Status</th>
						<th class="px-4 py-2 text-left text-gray-600">Open Lines</th>
					</tr>
				</thead>
				<tbody>
					{#each data.overdue as po (po.id)}
						<tr
							class="border-b border-amber-100 bg-amber-50 cursor-pointer border-l-2 border-l-amber-400"
							onclick={() => goto(`/receiving/${po.id}`)}
						>
							<td class="px-4 py-2 font-medium">
								<a href="/receiving/{po.id}" class="text-blue-700 hover:underline"
									>{po.po_number}</a
								>
							</td>
							<td class="px-4 py-2 text-gray-700">{po.vendor_name}</td>
							<td class="px-4 py-2 text-amber-700 font-medium"
								>{fmtDate(po.expected_date)}</td
							>
							<td class="px-4 py-2"><span class="badge-amber">Overdue</span></td>
							<td class="px-4 py-2 text-gray-500">{po.open_lines}</td>
						</tr>
					{/each}

					{#if data.overdue.length && data.upcoming.length}
						<tr>
							<td colspan="5" class="px-4 py-1 bg-gray-50 border-y border-gray-200">
								<span
									class="text-xs font-medium text-gray-400 uppercase tracking-wide"
									>Upcoming</span
								>
							</td>
						</tr>
					{/if}

					{#each data.upcoming as po (po.id)}
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
							<td class="px-4 py-2"><span class="badge-blue">Open</span></td>
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
