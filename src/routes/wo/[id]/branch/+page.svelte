<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wo, line, productionLines, isEditMode, editBlockers, cutDownBlockers } = $derived(data);
	const canSubmit = $derived(!isEditMode || editBlockers.length === 0);

	let rows = $state([]);
	let cutDownDialog = $state(null);

	$effect(() => {
		if (rows.length > 0) return;
		rows =
			isEditMode && productionLines.length > 0
				? productionLines.map((productionLine) => ({
						width_in: String(productionLine.width_in),
						qty: String(productionLine.qty),
						length_ft: String(productionLine.length_ft),
					}))
				: [{ width_in: '', qty: String(line.qty), length_ft: String(line.length_ft) }];
	});

	function addRow() {
		rows = [
			...rows,
			{ width_in: '', qty: String(line.qty), length_ft: String(line.length_ft) },
		];
	}

	function removeRow(i) {
		if (rows.length <= 1) return;
		rows = rows.filter((_, idx) => idx !== i);
	}

	// Equal-cut shortcut
	let shortcutWidth = $state('');
	let shortcutCount = $state('2');
	function expandShortcut() {
		const w = parseFloat(shortcutWidth);
		const n = parseInt(shortcutCount);
		if (!w || w <= 0 || !n || n < 1) return;
		rows = Array.from({ length: n }, () => ({
			width_in: String(w),
			qty: String(line.qty),
			length_ft: String(line.length_ft),
		}));
		shortcutWidth = '';
	}

	const sourceWidth = $derived(Number(line.width_in));
	const usedWidth = $derived(rows.reduce((s, r) => s + (parseFloat(r.width_in) || 0), 0));
	const waste = $derived(sourceWidth - usedWidth);
	const overWidth = $derived(usedWidth > sourceWidth);
</script>

<svelte:head
	><title>{isEditMode ? 'Edit Cut-Down Setup' : 'Set Cut-Down'} - WO {wo.so_number} - PandS</title
	></svelte:head
>

<header class="page-header px-6 py-4 flex items-center gap-4">
	<a href="/wo/{wo.id}" class="text-gray-400 hover:text-gray-600 text-sm">← WO {wo.so_number}</a>
	<h1 class="text-lg font-semibold text-gray-900">
		{isEditMode ? 'Edit Cut-Down Setup' : 'Set Cut-Down'}
	</h1>
</header>

<main class="p-6 max-w-2xl space-y-4">
	{#if form?.error}
		<div class="px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
			{form.error}
		</div>
	{/if}
	{#if isEditMode && editBlockers.length > 0}
		<div
			class="px-4 py-3 rounded-md text-sm bg-amber-50 text-amber-800 border border-amber-200"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<span>
					This cut-down setup cannot be edited because it has downstream {editBlockers.join(
						', '
					)}
					activity.
				</span>
				{#if cutDownBlockers.length > 0}
					<button
						type="button"
						class="btn-secondary btn-sm"
						onclick={() => cutDownDialog.showModal()}>View cut-down activity</button
					>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Billing line reference (read-only) -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700"
				>{isEditMode
					? 'Billing Source Line'
					: 'Source Line (will become billing line)'}</span
			>
		</div>
		<div class="card-body grid grid-cols-3 gap-4 text-sm">
			<div>
				<p class="form-label">SKU</p>
				<p class="text-gray-900">{line.display_label}</p>
			</div>
			<div>
				<p class="form-label">Thickness</p>
				<p class="text-gray-900 font-mono">{line.thickness_in}"</p>
			</div>
			<div>
				<p class="form-label">Width (source)</p>
				<p class="text-gray-900 font-mono font-semibold">{line.width_in}"</p>
			</div>
			<div>
				<p class="form-label">Qty (rolls)</p>
				<p class="text-gray-900">{line.qty}</p>
			</div>
			<div>
				<p class="form-label">Length</p>
				<p class="text-gray-900 font-mono">{line.length_ft}'</p>
			</div>
			<div>
				<p class="form-label">Sq Ft</p>
				<p class="text-gray-900 font-mono">{fmtSqft(line.sqft)}</p>
			</div>
			{#if line.facing}
				<div>
					<p class="form-label">Facing</p>
					<p class="text-gray-900">{line.facing}</p>
				</div>
			{/if}
			{#if line.instructions}
				<div class="col-span-2">
					<p class="form-label">Instructions</p>
					<p class="text-gray-900">{line.instructions}</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Production widths form -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Cut-Down Widths</span>
		</div>
		<form method="POST" action="?/branch" use:enhance class="card-body space-y-4">
			<input type="hidden" name="woLineId" value={line.id} />
			<input type="hidden" name="mode" value={isEditMode ? 'edit' : 'create'} />

			<!-- Equal-cut shortcut -->
			<div class="flex items-end gap-2 pb-2 border-b border-gray-100">
				<div>
					<label for="sc-width" class="form-label">Equal-cut shortcut</label>
					<input
						id="sc-width"
						type="number"
						step="0.5"
						min="0.5"
						placeholder="Width &quot;"
						class="form-input w-28"
						bind:value={shortcutWidth}
						disabled={!canSubmit}
					/>
				</div>
				<div>
					<label for="sc-count" class="form-label">Count</label>
					<input
						id="sc-count"
						type="number"
						min="1"
						max="20"
						class="form-input w-20"
						bind:value={shortcutCount}
						disabled={!canSubmit}
					/>
				</div>
				<button
					type="button"
					class="btn-secondary btn-sm mb-px"
					onclick={expandShortcut}
					disabled={!canSubmit}>Expand</button
				>
			</div>

			<!-- Dynamic width rows -->
			<div class="space-y-2">
				<div
					class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-gray-500 font-medium px-1"
				>
					<span>Width (in) *</span><span>Qty (rolls)</span><span>Length (ft)</span><span
					></span>
				</div>
				{#each rows as row, i (i)}
					<div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
						<input
							type="number"
							name="width_{i}"
							step="0.5"
							min="0.5"
							max={line.width_in}
							placeholder="{line.width_in}&quot;"
							class="form-input"
							bind:value={row.width_in}
							disabled={!canSubmit}
							required
						/>
						<input
							type="number"
							name="qty_{i}"
							min="1"
							class="form-input bg-gray-50 text-gray-500 cursor-not-allowed"
							bind:value={row.qty}
							disabled={!canSubmit}
							readonly
						/>
						<input
							type="number"
							name="length_ft_{i}"
							step="0.5"
							min="1"
							class="form-input bg-gray-50 text-gray-500 cursor-not-allowed"
							bind:value={row.length_ft}
							disabled={!canSubmit}
							readonly
						/>
						<button
							type="button"
							class="text-gray-400 hover:text-red-500 text-lg leading-none px-1 disabled:opacity-30"
							disabled={rows.length <= 1 || !canSubmit}
							onclick={() => removeRow(i)}>×</button
						>
					</div>
				{/each}
			</div>

			<button
				type="button"
				class="btn-secondary btn-sm"
				onclick={addRow}
				disabled={!canSubmit}>+ Add Width</button
			>

			<!-- Waste calculator -->
			<div
				class="rounded-md border px-4 py-3 text-sm flex gap-6 {overWidth
					? 'bg-red-50 border-red-200 text-red-700'
					: waste > 0
						? 'bg-amber-50 border-amber-200 text-amber-700'
						: 'bg-green-50 border-green-200 text-green-700'}"
			>
				<span>Source: <strong>{sourceWidth}"</strong></span>
				<span>Used: <strong>{usedWidth}"</strong></span>
				<span>Waste: <strong>{waste}"</strong></span>
				{#if overWidth}<span class="font-semibold">⚠ Exceeds source width</span>{/if}
			</div>

			<div class="flex gap-2 pt-2">
				<button type="submit" class="btn-primary" disabled={overWidth || !canSubmit}
					>{isEditMode ? 'Save Setup' : 'Set Cut-Down'}</button
				>
				<a href="/wo/{wo.id}" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>

	<dialog bind:this={cutDownDialog} class="modal-dialog modal-dialog-md">
		<div class="space-y-4">
			<div>
				<p class="text-sm font-medium text-gray-900 mb-1">Blocking cut-down activity</p>
				<p class="text-xs text-gray-500">
					This setup cannot be edited while these cut-down records exist.
				</p>
			</div>

			<div class="space-y-2">
				{#each cutDownBlockers as cutDown (cutDown.id)}
					<div class="border border-gray-200 rounded-md px-3 py-2 text-xs space-y-1">
						<div class="flex items-center justify-between gap-2">
							<span class="font-semibold text-gray-800"
								>{cutDown.cut_down_number}</span
							>
							<span class="badge-gray text-xs">{cutDown.status}</span>
						</div>
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
							<span>{cutDown.sku_label}</span>
							<span
								>Run: {cutDown.run_date
									? fmtDate(cutDown.run_date)
									: 'Unscheduled'}</span
							>
							<span>Rolls: {cutDown.rolls_scheduled}</span>
							<span>Sq Ft: {fmtSqft(cutDown.sqft_scheduled)}</span>
						</div>
						<a
							href="/wo/{wo.id}/cutdown/{cutDown.id}/confirm"
							class="text-blue-600 hover:underline">View cut-down</a
						>
					</div>
				{/each}
			</div>

			<div class="flex justify-end gap-2">
				<a href="/wo/{wo.id}/cutdown" class="btn-secondary btn-sm">Open Cut-Downs</a>
				<button
					type="button"
					class="btn-primary btn-sm"
					onclick={() => cutDownDialog.close()}
				>
					Close
				</button>
			</div>
		</div>
	</dialog>
</main>
