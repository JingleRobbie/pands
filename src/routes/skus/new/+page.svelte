<script>
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Add SKU - PandS</title></svelte:head>

<div class="p-6 max-w-md">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">Add SKU</h1>
		<a href="/skus" class="btn-secondary btn-sm">← SKUs</a>
	</div>

	<form method="POST" use:enhance class="space-y-4">
		{#if form?.error}<p class="text-red-600 text-sm">{form.error}</p>{/if}

		<div class="card card-body space-y-4">
			<div>
				<label for="sku_code" class="form-label">SKU Code *</label>
				<input id="sku_code" name="sku_code" class="form-input max-w-xs" value={form?.sku_code ?? ''} placeholder="e.g. 4048" required />
			</div>
			<div>
				<label for="display_label" class="form-label">Display Label *</label>
				<input id="display_label" name="display_label" class="form-input" value={form?.display_label ?? ''} placeholder='e.g. 4"×48"' required />
			</div>
			<div class="flex gap-4">
				<div>
					<label for="thickness_in" class="form-label">Thickness (in) *</label>
					<input id="thickness_in" name="thickness_in" type="number" step="0.5" min="0" class="form-input w-24" value={form?.thickness_in ?? ''} required />
				</div>
				<div>
					<label for="width_in" class="form-label">Width (in) *</label>
					<input id="width_in" name="width_in" type="number" min="1" class="form-input w-24" value={form?.width_in ?? ''} required />
				</div>
			</div>
			<div>
				<label for="r_value" class="form-label">R-Value</label>
				<input id="r_value" name="r_value" class="form-input max-w-xs" value={form?.r_value ?? ''} placeholder="e.g. R-13" />
			</div>
			<div>
				<label for="sort_order" class="form-label">Sort Order</label>
				<input id="sort_order" name="sort_order" type="number" class="form-input w-28" value={form?.sort_order ?? ''} placeholder="e.g. 110" />
			</div>
			<div class="flex gap-6">
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" name="pebs" class="rounded border-gray-300" />
					<span class="text-sm text-gray-700">PEBS</span>
				</label>
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" name="is_active" class="rounded border-gray-300" checked />
					<span class="text-sm text-gray-700">Active</span>
				</label>
			</div>
		</div>

		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Create SKU</button>
			<a href="/skus" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
