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

		<form id="edit-form" method="POST" use:enhance>
			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">PO Details</span>
				</div>
				<div class="card-body grid grid-cols-3 gap-4">
					<div>
						<label class="form-label" for="po_number">PO Number</label>
						<input
							id="po_number"
							type="text"
							name="po_number"
							class="form-input"
							required
							value={po.po_number}
						/>
					</div>
					<div>
						<label class="form-label" for="vendor_name">Vendor</label>
						<select id="vendor_name" name="vendor_name" class="form-select" required>
							<option value="">— select —</option>
							<option
								value="Johns Manville"
								selected={po.vendor_name === 'Johns Manville'}
								>Johns Manville</option
							>
							<option value="Certainteed" selected={po.vendor_name === 'Certainteed'}
								>Certainteed</option
							>
						</select>
					</div>
					<div>
						<label class="form-label" for="expected_date">Expected Date</label>
						<input
							id="expected_date"
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
								<label class="form-label text-xs" for="line-sku-{line.id}"
									>SKU</label
								>
								<p class="form-input text-sm bg-gray-50 text-gray-700">
									{line.display_label}
								</p>
							</div>
							<div class="w-36">
								<label class="form-label text-xs" for="line-sqft-{line.id}"
									>Sq Ft</label
								>
								<input
									id="line-sqft-{line.id}"
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
						{#each receivedLines as line (line.id)}
							<div class="flex items-end gap-3 opacity-60">
								<div class="flex-1">
									<label class="form-label text-xs" for="received-sku-{line.id}"
										>SKU</label
									>
									<p
										id="received-sku-{line.id}"
										class="form-input text-sm bg-gray-50 text-gray-500"
									>
										{line.display_label}
									</p>
								</div>
								<div class="w-36">
									<label class="form-label text-xs" for="received-sqft-{line.id}"
										>Sq Ft</label
									>
									<p
										id="received-sqft-{line.id}"
										class="form-input text-sm text-right font-mono bg-gray-50 text-gray-500"
									>
										{Math.round(line.sqft_ordered).toLocaleString()}
									</p>
								</div>
								<span class="badge-green pb-2">Received</span>
							</div>
						{/each}
					{/if}

					{#each newLines as line, i (i)}
						<div
							class="flex items-end gap-3 border-t border-dashed border-gray-200 pt-3"
						>
							<div class="flex-1">
								<label class="form-label text-xs" for="new-sku-{i}">SKU</label>
								<select
									id="new-sku-{i}"
									name="sku_id"
									class="form-select text-sm"
									bind:value={line.sku_id}
									required
								>
									<option value="">— select —</option>
									{#each skus as sku (sku.id)}<option value={sku.id}
											>{sku.display_label}</option
										>{/each}
								</select>
							</div>
							<div class="w-36">
								<label class="form-label text-xs" for="new-sqft-{i}">Sq Ft</label>
								<input
									id="new-sqft-{i}"
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
		</form>

		<div class="flex items-center justify-between">
			<div class="flex gap-3">
				<button type="submit" form="edit-form" class="btn-primary">Save Changes</button>
				<a href="/po/{po.id}" class="btn-secondary">Cancel</a>
			</div>
			<form
				method="POST"
				action="/po/{po.id}?/cancel"
				use:enhance={({ cancel }) => {
					if (!confirm(`Cancel PO ${po.po_number}?`)) cancel();
				}}
			>
				<button
					type="submit"
					class="rounded-md px-3 py-1.5 text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 transition-colors"
					>Cancel PO</button
				>
			</form>
		</div>
	</div>
</main>
