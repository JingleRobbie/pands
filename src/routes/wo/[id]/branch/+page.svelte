<script>
	import { enhance } from '$app/forms';
	import { fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wo, line } = $derived(data);

	let rows = $state([]);

	$effect(() => {
		if (rows.length > 0) return;
		rows = [{ width_in: '', qty: String(line.qty), length_ft: String(line.length_ft) }];
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

<svelte:head><title>Branch Line — WO {wo.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href="/wo/{wo.id}" class="text-gray-400 hover:text-gray-600 text-sm">← WO {wo.so_number}</a>
	<h1 class="text-lg font-semibold text-gray-900">Branch Line</h1>
</header>

<main class="p-6 max-w-2xl space-y-4">
	{#if form?.error}
		<div class="px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
			{form.error}
		</div>
	{/if}

	<!-- Billing line reference (read-only) -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700"
				>Source Line (will become billing line)</span
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
					<p class="text-gray-600 italic text-xs">{line.instructions}</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Production widths form -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Production Widths</span>
		</div>
		<form method="POST" action="?/branch" use:enhance class="card-body space-y-4">
			<input type="hidden" name="woLineId" value={line.id} />

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
					/>
				</div>
				<button type="button" class="btn-secondary btn-sm mb-px" onclick={expandShortcut}
					>Expand</button
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
							required
						/>
						<input
							type="number"
							name="qty_{i}"
							min="1"
							class="form-input"
							bind:value={row.qty}
						/>
						<input
							type="number"
							name="length_ft_{i}"
							step="0.5"
							min="1"
							class="form-input"
							bind:value={row.length_ft}
						/>
						<button
							type="button"
							class="text-gray-400 hover:text-red-500 text-lg leading-none px-1 disabled:opacity-30"
							disabled={rows.length <= 1}
							onclick={() => removeRow(i)}>×</button
						>
					</div>
				{/each}
			</div>

			<button type="button" class="btn-secondary btn-sm" onclick={addRow}>+ Add Width</button>

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
				<button type="submit" class="btn-primary" disabled={overWidth}>Branch Line</button>
				<a href="/wo/{wo.id}" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</main>
