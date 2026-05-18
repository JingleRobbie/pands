<script>
	import { enhance } from '$app/forms';
	import { skuLabel } from '$lib/utils.js';
	let { data, form } = $props();
	const { sku } = data;
</script>

<svelte:head><title>{skuLabel(sku.display_label, sku.pebs)} — PandS</title></svelte:head>

<div class="p-6 max-w-md">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">{skuLabel(sku.display_label, sku.pebs)}</h1>
		<a href="/skus" class="btn-secondary btn-sm">← SKUs</a>
	</div>

	<form method="POST" use:enhance class="space-y-4">
		{#if form?.error}<p class="text-red-600 text-sm">{form.error}</p>{/if}
		{#if form?.success}<p class="text-green-600 text-sm">Saved.</p>{/if}

		<div class="card card-body space-y-4">
			<div class="pb-3 mb-1 border-b border-gray-100 text-sm text-gray-500 space-y-1">
				<div><span class="font-medium text-gray-700">Code:</span> <span class="font-mono">{sku.sku_code}</span></div>
				<div><span class="font-medium text-gray-700">Thickness:</span> {sku.thickness_in}"&ensp;<span class="font-medium text-gray-700">Width:</span> {sku.width_in}"</div>
			</div>
			<div>
				<label for="display_label" class="form-label">Display Label *</label>
				<input id="display_label" name="display_label" class="form-input" value={form?.display_label ?? sku.display_label} required />
			</div>
			<div>
				<label for="r_value" class="form-label">R-Value</label>
				<input id="r_value" name="r_value" class="form-input max-w-xs" value={form?.r_value ?? sku.r_value ?? ''} placeholder="e.g. R-13" />
			</div>
			<div>
				<label for="sort_order" class="form-label">Sort Order</label>
				<input id="sort_order" name="sort_order" type="number" class="form-input w-28" value={form?.sort_order ?? sku.sort_order} required />
			</div>
			<div class="flex gap-6">
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" name="pebs" class="rounded border-gray-300" checked={!!sku.pebs} />
					<span class="text-sm text-gray-700">PEBS</span>
				</label>
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" name="is_active" class="rounded border-gray-300" checked={!!sku.is_active} />
					<span class="text-sm text-gray-700">Active</span>
				</label>
			</div>
		</div>

		<button type="submit" class="btn-primary">Save Changes</button>
	</form>
</div>
