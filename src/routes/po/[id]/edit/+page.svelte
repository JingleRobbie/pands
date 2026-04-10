<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const { po, skus } = data;

	// Editable open lines — start from server data
	let openLines = $state(data.lines.filter((l) => l.status === 'OPEN').map((l) => ({ ...l })));
	let receivedLines = $derived(data.lines.filter((l) => l.status !== 'OPEN'));

	// New lines to add
	let newLines = $state([]);
	function addLine() {
		newLines = [...newLines, { sku_id: '', sqft: '' }];
	}
	function removeNewLine(i) {
		newLines = newLines.filter((_, idx) => idx !== i);
	}
	function removeOpenLine(id) {
		openLines = openLines.filter((l) => l.id !== id);
	}
</script>

<svelte:head><title>Edit PO {po.po_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Edit PO {po.po_number}</h1>
	<a href="/po/{po.id}" class="btn-secondary btn-sm">Cancel</a>
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
							value={po.po_number}
						/>
					</div>
					<div>
						<label class="form-label">Vendor</label>
						<select name="vendor_name" class="form-select" required>
							<option value="">— select —</option>
							<option value="JM" selected={po.vendor_name === 'JM'}>JM</option>
							<option value="Certainteed" selected={po.vendor_name === 'Certainteed'}
								>Certainteed</option
							>
						</select>
					</div>
					<div>
						<label class="form-label">Expected Date</label>
						<input
							type="date"
							name="expected_date"
							class="form-input"
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
					<button type="button" onclick={addLine} class="btn-secondary btn-sm"
						>+ Add Line</button
					>
				</div>
				<div class="card-body space-y-3">
					{#each openLines as line (line.id)}
						<div class="flex items-end gap-3">
							<input type="hidden" name="line_id" value={line.id} />
							<div class="flex-1">
								<label class="form-label text-xs">SKU</label>
								<p class="form-input text-sm bg-gray-50 text-gray-700">
									{line.display_label}
								</p>
							</div>
							<div class="w-36">
								<label class="form-label text-xs">Sq Ft</label>
								<input
									type="number"
									name="line_sqft"
									step="1"
									min="1"
									class="form-input text-sm text-right font-mono"
									bind:value={line.sqft_ordered}
									required
								/>
							</div>
							<button
								type="button"
								onclick={() => removeOpenLine(line.id)}
								class="text-gray-400 hover:text-red-500 text-xl pb-2"
								>&times;</button
							>
						</div>
					{/each}

					{#if receivedLines.length}
						{#each receivedLines as line}
							<div class="flex items-end gap-3 opacity-60">
								<div class="flex-1">
									<label class="form-label text-xs">SKU</label>
									<p class="form-input text-sm bg-gray-50 text-gray-500">
										{line.display_label}
									</p>
								</div>
								<div class="w-36">
									<label class="form-label text-xs">Sq Ft</label>
									<p
										class="form-input text-sm text-right font-mono bg-gray-50 text-gray-500"
									>
										{Math.round(line.sqft_ordered).toLocaleString()}
									</p>
								</div>
								<span class="badge-green pb-2">Received</span>
							</div>
						{/each}
					{/if}

					{#each newLines as line, i}
						<div
							class="flex items-end gap-3 border-t border-dashed border-gray-200 pt-3"
						>
							<div class="flex-1">
								<label class="form-label text-xs">SKU</label>
								<select
									name="sku_id"
									class="form-select text-sm"
									bind:value={line.sku_id}
									required
								>
									<option value="">— select —</option>
									{#each skus as sku}<option value={sku.id}
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
							<button
								type="button"
								onclick={() => removeNewLine(i)}
								class="text-gray-400 hover:text-red-500 text-xl pb-2"
								>&times;</button
							>
						</div>
					{/each}

					{#if openLines.length === 0 && newLines.length === 0}
						<p class="text-sm text-amber-700">Add at least one open line.</p>
					{/if}
				</div>
			</div>

			<div class="flex gap-3">
				<button type="submit" class="btn-primary">Save Changes</button>
				<a href="/po/{po.id}" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</main>
