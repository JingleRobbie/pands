<script>
	import { enhance } from '$app/forms';
	import { fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	// const { wo, diffRows, skus } = $derived(data);

	let expandedSplit = $state(null); // billingLineId of open split form
	let splitLines = $state([{ skuId: '', widthIn: '', qty: '', lengthFt: '' }]);

	function addSplitLine() {
		splitLines = [...splitLines, { skuId: '', widthIn: '', qty: '', lengthFt: '' }];
	}
	function removeSplitLine(i) {
		if (splitLines.length <= 2) return;
		splitLines = splitLines.filter((_, idx) => idx !== i);
	}
</script>

<svelte:head><title>Diff - WO {data.wo.so_number} - PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href="/wo/{data.wo.id}" class="text-gray-400 hover:text-gray-600 text-sm"
		>← WO {data.wo.so_number}</a
	>
	<h1 class="text-lg font-semibold text-gray-900">Billing / Production Diff</h1>
	{#if data.diffRows.some((r) => r.needsReconciliation)}
		<span class="badge-amber">Stale lines need reconciliation</span>
	{/if}
</header>

<main class="p-6 max-w-6xl space-y-4">
	{#if form?.error}
		<div class="px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
			{form.error}
		</div>
	{/if}

	<div>
		<div class="grid grid-cols-2 divide-x-4 divide-gray-100 text-sm">
			<!-- Billing column -->
			<div class="py-0 px-1">
				<table class="w-full text-xs">
					<tbody>
						<tr class="border-t border-gray-50">
							<td class="py-0"
								><p
									class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2"
								>
									Billing
								</p></td
							>
							<td class="text-right py-0"
								><p
									class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2"
								>
									Sq Ft
								</p></td
							>
						</tr>
					</tbody>
				</table>
			</div>
			<div class="py-0 px-1">
				<table class="w-full text-xs">
					<tbody>
						<tr class="border-t border-gray-50">
							<td class="py-0"
								><p
									class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2"
								>
									Production
								</p></td
							>
							<td class="text-right py-0"
								><p
									class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2"
								>
									Sq Ft
								</p></td
							>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
	{#each data.diffRows as row (row.billingLine.id)}
		{@const bl = row.billingLine}
		{@const isSuperseded = bl.reconciliation_status === 'SUPERSEDED'}

		<div class="card {row.needsReconciliation ? 'border-amber-300' : ''}">
			<!-- Row header -->
			<!-- <div class="flex items-center gap-2 text-sm">
					{#if row.cutDown}
						<span class="text-xs text-gray-400">
							Cut-down: {row.cutDown.status}
							{#if row.cutDown.confirmed_at}· {fmtDate(row.cutDown.confirmed_at)}{/if}
						</span>
					{/if}
				</div> -->

			{#if isSuperseded}
				<div class="card-body text-sm text-gray-400 italic">
					Superseded - replaced by new billing lines below.
				</div>
			{:else}
				<!-- Side-by-side: billing left, production right -->
				<div
					class="grid grid-cols-2 divide-x-4 {row.isUnbranched
						? 'divide-gray-100'
						: 'divide-red-100'} text-sm"
				>
					<!-- Billing column -->
					<div class="py-0 px-1">
						<!-- <span class={statusBadge[bl.reconciliation_status] ?? 'badge-gray'}>
								{bl.reconciliation_status}
							</span>
							{#if row.cutDown}
								<span class="text-xs text-gray-400">
									Cut-down: {row.cutDown.status}
									{#if row.cutDown.confirmed_at}· {fmtDate(row.cutDown.confirmed_at)}{/if}
								</span>
							{/if} -->
						<table class="w-full text-xs">
							<tbody>
								<tr class="border-t border-gray-50">
									<td class="font-mono py-1 text-xs"
										>{bl.facing}
										{bl.tab_type}
										{bl.thickness_in}" × {bl.width_in}" × {bl.length_ft}'</td
									>
									<td class="text-right font-mono py-1">{fmtSqft(bl.sqft)}</td>
								</tr>
							</tbody>
						</table>
					</div>

					<!-- Production column -->
					<div class="py-0 px-1">
						{#if row.isUnbranched}
							<table class="w-full text-xs">
								<tbody>
									<tr class="border-t border-gray-50">
										<td class="font-mono py-1 text-xs"
											>{bl.facing}
											{bl.tab_type}
											{bl.thickness_in}" × {bl.width_in}" × {bl.length_ft}'</td
										>
										<td class="text-right font-mono py-1">{fmtSqft(bl.sqft)}</td
										>
									</tr>
								</tbody>
							</table>
						{:else}
							<table class="w-full text-xs">
								<tbody>
									{#each row.productionLines as pl (pl.id)}
										<tr class="border-t border-gray-50">
											<td class="font-mono py-1 text-xs"
												>{bl.facing}
												{bl.tab_type}
												{bl.thickness_in}" × {pl.width_in}" × {bl.length_ft}'</td
											>
											<td class="text-right font-mono py-1"
												>{fmtSqft(pl.sqft)}</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>

				<!-- Reconciliation form (STALE only) -->
				{#if row.needsReconciliation}
					<div class="border-t border-amber-200 bg-amber-50 p-4 space-y-3">
						<p class="text-sm font-medium text-amber-800">
							Reconcile this billing line
						</p>

						<form
							method="POST"
							action="?/reconcileLine"
							use:enhance
							class="flex flex-wrap gap-3 items-end text-sm"
						>
							<input type="hidden" name="billingLineId" value={bl.id} />
							<div>
								<label for="sku-{bl.id}" class="form-label">New SKU</label>
								<select
									id="sku-{bl.id}"
									name="newSkuId"
									class="form-select text-sm py-1"
								>
									<option value="">- unchanged -</option>
									{#each data.skus as sku (sku.id)}
										<option value={sku.id} selected={sku.id === bl.sku_id}
											>{sku.display_label}</option
										>
									{/each}
								</select>
							</div>
							<div>
								<label for="width-{bl.id}" class="form-label">Width (in)</label>
								<input
									id="width-{bl.id}"
									name="newWidthIn"
									type="number"
									step="0.5"
									placeholder={bl.width_in}
									class="form-input w-24 text-sm py-1"
								/>
							</div>
							<div>
								<label for="qty-{bl.id}" class="form-label">Qty</label>
								<input
									id="qty-{bl.id}"
									name="newQty"
									type="number"
									placeholder={bl.qty}
									class="form-input w-20 text-sm py-1"
								/>
							</div>
							<div>
								<label for="len-{bl.id}" class="form-label">Length (ft)</label>
								<input
									id="len-{bl.id}"
									name="newLengthFt"
									type="number"
									step="0.5"
									placeholder={bl.length_ft}
									class="form-input w-24 text-sm py-1"
								/>
							</div>
							<button type="submit" class="btn-primary btn-sm">Reconcile</button>
							<button
								type="button"
								class="btn-secondary btn-sm"
								onclick={() => {
									expandedSplit = expandedSplit === bl.id ? null : bl.id;
									splitLines = [
										{ skuId: '', widthIn: '', qty: '', lengthFt: '' },
									];
								}}
							>
								Split Line
							</button>
						</form>

						{#if expandedSplit === bl.id}
							<form
								method="POST"
								action="?/splitLine"
								use:enhance
								class="space-y-2 pt-2 border-t border-amber-200"
							>
								<input type="hidden" name="billingLineId" value={bl.id} />
								<p class="text-xs font-medium text-amber-800">
									Split into {splitLines.length} new billing lines
								</p>
								{#each splitLines as sl, i (i)}
									<div class="flex gap-2 items-center">
										<select
											bind:value={sl.skuId}
											class="form-select text-xs py-1 w-40"
										>
											<option value="">- SKU -</option>
											{#each data.skus as sku (sku.id)}
												<option value={sku.id}>{sku.display_label}</option>
											{/each}
										</select>
										<input
											type="number"
											step="0.5"
											placeholder="Width"
											bind:value={sl.widthIn}
											class="form-input w-20 text-xs py-1"
										/>
										<input
											type="number"
											placeholder="Qty"
											bind:value={sl.qty}
											class="form-input w-16 text-xs py-1"
										/>
										<input
											type="number"
											step="0.5"
											placeholder="Length'"
											bind:value={sl.lengthFt}
											class="form-input w-20 text-xs py-1"
										/>
										<button
											type="button"
											class="text-gray-400 hover:text-red-500 text-lg leading-none px-1 disabled:opacity-30"
											disabled={splitLines.length <= 2}
											onclick={() => removeSplitLine(i)}>×</button
										>
									</div>
								{/each}
								<input
									type="hidden"
									name="newLines"
									value={JSON.stringify(
										splitLines.map((l) => ({
											skuId: l.skuId ? parseInt(l.skuId) : null,
											widthIn: l.widthIn ? parseFloat(l.widthIn) : null,
											qty: l.qty ? parseInt(l.qty) : null,
											lengthFt: l.lengthFt ? parseFloat(l.lengthFt) : null,
										}))
									)}
								/>
								<div class="flex gap-2">
									<button
										type="button"
										class="btn-secondary btn-sm"
										onclick={addSplitLine}>+ Add Line</button
									>
									<button type="submit" class="btn-danger btn-sm"
										>Split & Supersede</button
									>
								</div>
							</form>
						{/if}
					</div>
				{:else if bl.reconciliation_status === 'RECONCILED'}
					<div class="border-t border-gray-100 px-4 py-2 text-xs text-green-600">
						✓ Reconciled
					</div>
				{/if}
			{/if}
		</div>
	{/each}
	{#if data.diffRows.length === 0}
		<div class="card card-body text-sm text-gray-400">No lines on this work order.</div>
	{/if}
</main>
