<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { skuLabel } from '$lib/utils.js';
	let { data } = $props();
	const isAdmin = data.appUser?.role === 'admin';
	const created = $derived($page.url.searchParams.get('created'));
</script>

<svelte:head><title>SKUs — PandS</title></svelte:head>

<div class="p-6">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">Material SKUs</h1>
		{#if isAdmin}
			<a href="/skus/new" class="btn-primary">Add SKU</a>
		{/if}
	</div>

	{#if created}
		<div class="mb-4 px-4 py-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
			SKU <span class="font-mono font-medium">{created}</span> created.
		</div>
	{/if}

	<div class="card overflow-x-auto">
		<table class="dense-list-table min-w-[32rem]">
			<thead>
				<tr>
					<th>Label</th>
					<th>Code</th>
					<th>Thickness</th>
					<th>Width</th>
					<th>R-Value</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each data.skus as sku (sku.id)}
					<tr
						class="{isAdmin ? 'cursor-pointer' : ''} {!sku.is_active ? 'opacity-50' : ''}"
						onclick={isAdmin ? () => goto(`/skus/${sku.id}`) : undefined}
					>
						<td class="font-medium text-gray-900">{skuLabel(sku.display_label, sku.pebs)}</td>
						<td class="font-mono text-gray-500">{sku.sku_code}</td>
						<td class="text-gray-600">{sku.thickness_in}"</td>
						<td class="text-gray-600">{sku.width_in}"</td>
						<td class="text-gray-600">{sku.r_value ?? '—'}</td>
						<td>
							{#if sku.is_active}
								<span class="badge badge-green">Active</span>
							{:else}
								<span class="badge badge-red">Inactive</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
