<script>
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	let { data, form } = $props();
	const so = $derived(data.so);
	const skus = $derived(data.skus);

	// Editable lines = no production runs
	let editableLines = $state(
		untrack(() => data.lines.filter((l) => Number(l.run_count) === 0).map((l) => ({ ...l })))
	);
	let lockedLines = $derived(data.lines.filter((l) => Number(l.run_count) > 0));

	let newLines = $state([]);
	function addLine() {
		newLines = [...newLines, { sku_id: '', sqft: '', facing: 'Faced' }];
	}
	function removeNewLine(i) {
		newLines = newLines.filter((_, idx) => idx !== i);
	}
	function removeEditableLine(id) {
		editableLines = editableLines.filter((l) => l.id !== id);
	}
</script>

<svelte:head><title>Edit SO {so.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Edit SO {so.so_number}</h1>
	<a href="/so/{so.id}" class="btn-secondary btn-sm">Cancel</a>
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
					<span class="font-semibold text-sm text-gray-700">Order Details</span>
				</div>
				<div class="card-body grid grid-cols-2 gap-4">
					<div>
						<label for="so_number" class="form-label">SO Number</label>
						<input
							id="so_number"
							type="text"
							name="so_number"
							class="form-input"
							required
							value={so.so_number}
						/>
					</div>
					<div>
						<label for="customer_name" class="form-label">Customer</label>
						<input
							id="customer_name"
							type="text"
							name="customer_name"
							class="form-input"
							required
							value={so.customer_name}
						/>
					</div>
					<div>
						<label for="job_name" class="form-label">Job Name</label>
						<input
							id="job_name"
							type="text"
							name="job_name"
							class="form-input"
							required
							value={so.job_name}
						/>
					</div>
					<div>
						<label for="ship_date" class="form-label">Ship Date</label>
						<input
							id="ship_date"
							type="date"
							name="ship_date"
							class="form-input"
							required
							value={so.ship_date instanceof Date
								? so.ship_date.toISOString().slice(0, 10)
								: String(so.ship_date).slice(0, 10)}
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
					{#each editableLines as line (line.id)}
						<div class="flex items-end gap-3">
							<input type="hidden" name="line_id" value={line.id} />
							<div class="flex-1">
								<label for="sku-{line.id}" class="form-label text-xs">SKU</label>
								<p
									id="sku-{line.id}"
									class="form-input text-sm bg-gray-50 text-gray-700"
								>
									{line.display_label}
								</p>
							</div>
							<div class="w-28">
								<label for="facing-{line.id}" class="form-label text-xs"
									>Facing</label
								>
								<select
									id="facing-{line.id}"
									name="line_facing"
									class="form-select text-sm"
									bind:value={line.facing}
								>
									<option value="Faced">Faced</option>
									<option value="Raw">Raw</option>
								</select>
							</div>
							<div class="w-36">
								<label for="sqft-{line.id}" class="form-label text-xs">Sq Ft</label>
								<input
									id="sqft-{line.id}"
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
								onclick={() => removeEditableLine(line.id)}
								class="text-gray-400 hover:text-red-500 text-xl pb-2"
								>&times;</button
							>
						</div>
					{/each}

					{#if lockedLines.length}
						{#each lockedLines as line (line.id)}
							<div class="flex items-end gap-3 opacity-60">
								<div class="flex-1">
									<label for="locked-sku-{line.id}" class="form-label text-xs"
										>SKU</label
									>
									<p
										id="locked-sku-{line.id}"
										class="form-input text-sm bg-gray-50 text-gray-500"
									>
										{line.display_label}
									</p>
								</div>
								<div class="w-28">
									<label for="locked-facing-{line.id}" class="form-label text-xs"
										>Facing</label
									>
									<p
										id="locked-facing-{line.id}"
										class="form-input text-sm bg-gray-50 text-gray-500"
									>
										{line.facing}
									</p>
								</div>
								<div class="w-36">
									<label for="locked-sqft-{line.id}" class="form-label text-xs"
										>Sq Ft</label
									>
									<p
										id="locked-sqft-{line.id}"
										class="form-input text-sm text-right font-mono bg-gray-50 text-gray-500"
									>
										{Math.round(line.sqft_ordered).toLocaleString()}
									</p>
								</div>
								<span class="text-xs text-gray-400 pb-2">has runs</span>
							</div>
						{/each}
					{/if}

					{#each newLines as line, i (i)}
						<div
							class="flex items-end gap-3 border-t border-dashed border-gray-200 pt-3"
						>
							<div class="flex-1">
								<label for="newsku-{i}" class="form-label text-xs">SKU</label>
								<select
									id="newsku-{i}"
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
							<div class="w-28">
								<label for="newfacing-{i}" class="form-label text-xs">Facing</label>
								<select
									id="newfacing-{i}"
									name="new_facing"
									class="form-select text-sm"
									bind:value={line.facing}
								>
									<option value="Faced">Faced</option>
									<option value="Raw">Raw</option>
								</select>
							</div>
							<div class="w-36">
								<label for="newsqft-{i}" class="form-label text-xs">Sq Ft</label>
								<input
									id="newsqft-{i}"
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
				</div>
			</div>

			<div class="flex gap-3">
				<button type="submit" class="btn-primary">Save Changes</button>
				<a href="/so/{so.id}" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</main>
