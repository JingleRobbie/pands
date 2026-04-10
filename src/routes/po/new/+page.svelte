<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let lines = $state([{ sku_id: '', sqft: '' }]);
	function addLine() {
		lines = [...lines, { sku_id: '', sqft: '' }];
	}
	function removeLine(i) {
		if (lines.length > 1) lines = lines.filter((_, idx) => idx !== i);
	}
</script>

<svelte:head><title>New Purchase Order — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">New Purchase Order</h1>
	<a href="/po" class="btn-secondary btn-sm">Cancel</a>
</header>
<main class="p-6">
	<div class="max-w-2xl">
		{#if form?.error}<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>{/if}

		<form method="POST" use:enhance>
			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">PO Details</span>
				</div>
				<div class="card-body grid grid-cols-3 gap-4">
					<div>
						<label class="form-label">PO Number</label>
						<input
							type="text"
							name="po_number"
							class="form-input"
							required
							placeholder="e.g. 54321"
						/>
					</div>
					<div>
						<label class="form-label">Vendor</label>
						<select name="vendor_name" class="form-select" required>
							<option value="">— select —</option>
							<option value="JM">JM</option>
							<option value="Certainteed">Certainteed</option>
						</select>
					</div>
					<div>
						<label class="form-label">Expected Date</label>
						<input type="date" name="expected_date" class="form-input" required />
					</div>
				</div>
			</div>

			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">Line Items</span>
					<button type="button" onclick={addLine} class="btn-secondary btn-sm"
						>+ Add Line</button
					>
				</div>
				<div class="card-body space-y-3">
					{#each lines as line, i}
						<div class="flex items-end gap-3">
							<div class="flex-1">
								<label class="form-label text-xs">SKU</label>
								<select
									name="sku_id"
									class="form-select text-sm"
									bind:value={line.sku_id}
									required
								>
									<option value="">— select —</option>
									{#each data.skus as sku}<option value={sku.id}
											>{sku.display_label}</option
										>{/each}
								</select>
							</div>
							<div class="w-36">
								<label class="form-label text-xs">Sq Ft</label>
								<input
									type="number"
									name="sqft_ordered"
									step="1"
									min="1"
									class="form-input text-sm text-right font-mono"
									bind:value={line.sqft}
									required
									placeholder="0"
								/>
							</div>
							{#if lines.length > 1}
								<button
									type="button"
									onclick={() => removeLine(i)}
									class="text-gray-400 hover:text-red-500 text-xl pb-2"
									>&times;</button
								>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="flex gap-3">
				<button type="submit" class="btn-primary">Save PO</button>
				<a href="/po" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</main>
