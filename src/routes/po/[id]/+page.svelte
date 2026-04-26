<script>
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import MatrixDrawer from '$lib/components/MatrixDrawer.svelte';
	import { fmtDate } from '$lib/utils.js';
	let { data } = $props();
	const { po, lines, matrix, receivedAt, user } = data;
	let outlookOpen = $state(false);

	function fmtSqft(n) {
		if (n == null) return '';
		return Math.round(n).toLocaleString();
	}
</script>

<svelte:head><title>PO {po.po_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">PO {po.po_number}</h1>
		<p class="text-sm text-gray-500 mt-0.5">{po.vendor_name}</p>
	</div>
	<div class="flex gap-2">
		{#if po.status === 'OPEN'}
			<a href="/receiving/{po.id}" class="btn-secondary btn-sm">Record Receipt</a>
			<a href="/po/{po.id}/edit" class="btn-secondary btn-sm">Edit</a>
			{#if user?.role === 'admin'}
				<form method="POST" action="?/cancel" use:enhance>
					<button type="submit" class="btn-danger btn-sm">Cancel PO</button>
				</form>
			{/if}
		{/if}
		<button onclick={() => (outlookOpen = !outlookOpen)} class="btn-secondary btn-sm"
			>Inventory Outlook</button
		>
		<a href="/po" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-2xl">
		<div class="card mb-4">
			<div class="card-body grid grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Vendor</span>
					<p class="font-medium mt-0.5">{po.vendor_name}</p>
				</div>
				<div>
					<span class="text-gray-500">Expected</span>
					<p class="font-medium mt-0.5">{fmtDate(po.expected_date)}</p>
				</div>
				<div>
					<span class="text-gray-500">Status</span>
					<p class="mt-0.5">
						{#if po.status === 'OPEN'}<span class="badge-blue">Open</span>
						{:else if po.status === 'CANCELLED'}<span class="badge-red">Cancelled</span>
						{:else}<span class="badge-green">Received</span>{/if}
					</p>
				</div>
				{#if receivedAt}
					{@const expectedStr = fmtDate(po.expected_date)}
					{@const receivedStr = fmtDate(receivedAt)}
					{@const differs = expectedStr !== receivedStr}
					<div class="col-span-3 border-t border-gray-100 pt-3 flex items-center gap-3">
						<span class="text-gray-500">Received</span>
						<span class="font-medium">{receivedStr}</span>
						{#if differs}
							<span class="badge-amber">
								{receivedAt < po.expected_date ? 'Early' : 'Late'}
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Lines</span>
			</div>
			<table class="w-full text-sm">
				<thead
					><tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">SKU</th>
						<th class="px-4 py-2 text-right text-gray-600">Ordered (sqft)</th>
					</tr></thead
				>
				<tbody>
					{#each lines as line (line.id)}
						<tr class="border-b border-gray-50">
							<td class="px-4 py-2 font-medium">{line.display_label}</td>
							<td class="px-4 py-2 text-right font-mono"
								>{Math.round(line.sqft_ordered).toLocaleString()}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<MatrixDrawer {matrix} bind:open={outlookOpen} />
</main>
