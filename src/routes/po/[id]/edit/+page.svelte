<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getReturnTo, withReturnTo } from '$lib/navigation.js';
	let { data, form } = $props();
	const po = $derived(data.po);
	const returnTo = $derived(getReturnTo(page.url, '/po'));
	const detailHref = $derived(withReturnTo(`/po/${po.id}`, returnTo));
</script>

<svelte:head><title>Edit PO {po.po_number} — PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Edit PO {po.po_number}</h1>
	<div class="flex gap-2">
		<a href="/receiving/{po.id}" class="btn-secondary btn-sm">Record Receipt</a>
		<a href={detailHref} class="btn-secondary btn-sm">Cancel</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-2xl">
		{#if form?.error}
			<div class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
				{form.error}
			</div>
		{/if}

		<form id="edit-form" method="POST" use:enhance>
			<input type="hidden" name="return_to" value={returnTo} />
			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">PO Details</span>
				</div>
				<div class="card-body grid grid-cols-3 gap-4">
					<div>
						<p class="form-label">PO Number</p>
						<p class="form-input bg-gray-50 text-gray-700">{po.po_number}</p>
					</div>
					<div>
						<p class="form-label">Vendor</p>
						<p class="form-input bg-gray-50 text-gray-700">{po.vendor_name}</p>
					</div>
					<div>
						<label class="form-label" for="expected_date">Expected Date</label>
						<input
							id="expected_date"
							type="date"
							name="expected_date"
							class="form-input w-40"
							required
							value={po.expected_date instanceof Date
								? po.expected_date.toISOString().slice(0, 10)
								: String(po.expected_date).slice(0, 10)}
						/>
					</div>
				</div>
			</div>

			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">Line Items</span>
				</div>
				<div class="card-body space-y-3">
					{#each data.lines as line (line.id)}
						<div class="flex items-end gap-3 {line.status !== 'OPEN' ? 'opacity-60' : ''}">
							<div class="flex-1">
								<p class="form-label text-xs">SKU</p>
								<p class="form-input text-sm bg-gray-50 text-gray-700">{line.display_label}</p>
							</div>
							<div class="w-36">
								<p class="form-label text-xs">Sq Ft</p>
								<p class="form-input text-sm text-right font-mono bg-gray-50 text-gray-700">
									{Math.round(line.sqft_ordered).toLocaleString()}
								</p>
							</div>
							{#if line.status !== 'OPEN'}
								<span class="badge-green pb-2">Received</span>
							{:else}
								<span class="w-6"></span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</form>

		<div class="flex items-center justify-between">
			<div class="flex gap-3">
				<button type="submit" form="edit-form" class="btn-primary">Save Changes</button>
				<a href={detailHref} class="btn-secondary">Cancel</a>
			</div>
			{#if data.user?.role === 'admin'}
				<a
					href="/po/{po.id}?/cancel"
					class="rounded-md px-3 py-1.5 text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 transition-colors"
				>Cancel PO</a>
			{/if}
		</div>
	</div>
</main>
