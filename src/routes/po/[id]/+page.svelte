<script>
	import { enhance } from '$app/forms';
	import MatrixDrawer from '$lib/components/MatrixDrawer.svelte';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const po = $derived(data.po);
	const lines = $derived(data.lines);
	const receivedLines = $derived(lines.filter((line) => line.status === 'RECEIVED'));
	const matrix = $derived(data.matrix);
	const receivedAt = $derived(data.receivedAt);
	const user = $derived(data.user);
	let outlookOpen = $state(false);
	let cancelDialog = $state(null);
	let unreceiveDialog = $state(null);
	let pendingUnreceive = $state(null);
	let unreceiveSubmitting = $state(false);

	function requestUnreceive(line = null) {
		pendingUnreceive = line;
		unreceiveDialog.showModal();
	}

	function unreceiveEnhance() {
		unreceiveSubmitting = true;
		return async ({ update }) => {
			unreceiveDialog.close();
			pendingUnreceive = null;
			unreceiveSubmitting = false;
			await update({ invalidateAll: true });
		};
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
				<button
					type="button"
					class="btn-danger btn-sm"
					onclick={() => cancelDialog.showModal()}>Cancel PO</button
				>
			{/if}
		{/if}
		{#if receivedLines.length > 0 && user?.role === 'admin'}
			<button
				type="button"
				class="btn-secondary btn-sm text-amber-700 border-amber-300 hover:border-amber-400"
				onclick={() => requestUnreceive()}>Unreceive PO</button
			>
		{/if}
		<button onclick={() => (outlookOpen = !outlookOpen)} class="btn-secondary btn-sm"
			>Inventory Outlook</button
		>
		<a href="/po" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-2xl">
		{#if form?.error}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>
		{/if}

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
						<th class="px-4 py-2 text-right text-gray-600">Received (sqft)</th>
						<th class="px-4 py-2 text-left text-gray-600">Status</th>
						{#if user?.role === 'admin'}
							<th class="px-4 py-2 text-right text-gray-600"></th>
						{/if}
					</tr></thead
				>
				<tbody>
					{#each lines as line (line.id)}
						<tr class="border-b border-gray-50">
							<td class="px-4 py-2 font-medium">{line.display_label}</td>
							<td class="px-4 py-2 text-right font-mono"
								>{fmtSqft(line.sqft_ordered)}</td
							>
							<td class="px-4 py-2 text-right font-mono text-gray-600">
								{line.sqft_received ? fmtSqft(line.sqft_received) : '—'}
							</td>
							<td class="px-4 py-2">
								{#if line.status === 'RECEIVED'}
									<span class="badge-green">Received</span>
								{:else if line.status === 'CANCELLED'}
									<span class="badge-red">Cancelled</span>
								{:else}
									<span class="badge-blue">Open</span>
								{/if}
							</td>
							{#if user?.role === 'admin'}
								<td class="px-4 py-2 text-right">
									{#if line.status === 'RECEIVED'}
										<button
											type="button"
											class="btn-secondary btn-sm text-amber-700 border-amber-300 hover:border-amber-400"
											onclick={() => requestUnreceive(line)}>Unreceive</button
										>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<MatrixDrawer {matrix} bind:open={outlookOpen} />
</main>

<dialog bind:this={cancelDialog} class="rounded-lg shadow-xl p-6 w-80 backdrop:bg-black/30">
	<p class="text-sm font-medium text-gray-900 mb-1">Cancel PO {po.po_number}?</p>
	<p class="text-xs text-gray-500 mb-4">This will cancel all open lines and cannot be undone.</p>
	<form method="POST" action="?/cancel" use:enhance>
		<div class="flex gap-2 justify-end">
			<button type="button" class="btn-secondary btn-sm" onclick={() => cancelDialog.close()}
				>Cancel</button
			>
			<button type="submit" class="btn-danger btn-sm">Cancel PO</button>
		</div>
	</form>
</dialog>

<dialog bind:this={unreceiveDialog} class="rounded-lg shadow-xl p-6 w-96 backdrop:bg-black/30">
	<p class="text-sm font-medium text-gray-900 mb-1">
		{pendingUnreceive ? 'Unreceive PO line?' : `Unreceive PO ${po.po_number}?`}
	</p>
	{#if pendingUnreceive}
		<p class="text-xs text-gray-500 mb-4">
			{pendingUnreceive.display_label} will be reopened and
			{fmtSqft(pendingUnreceive.sqft_received)} sq ft will be removed from inventory.
		</p>
	{:else}
		<p class="text-xs text-gray-500 mb-4">
			All {receivedLines.length} received line{receivedLines.length === 1 ? '' : 's'} will be reopened
			and their received quantities will be removed from inventory.
		</p>
	{/if}
	<form method="POST" action="?/unreceive" use:enhance={unreceiveEnhance}>
		{#if pendingUnreceive}
			<input type="hidden" name="line_id" value={pendingUnreceive.id} />
		{/if}
		<div class="flex gap-2 justify-end">
			<button
				type="button"
				class="btn-secondary btn-sm"
				onclick={() => {
					unreceiveDialog.close();
					pendingUnreceive = null;
				}}>Cancel</button
			>
			<button type="submit" class="btn-danger btn-sm" disabled={unreceiveSubmitting}
				>Unreceive</button
			>
		</div>
	</form>
</dialog>
