<script>
	import { enhance } from '$app/forms';
	import { fmtSqft, fmtDate, localDate } from '$lib/utils.js';
	let { data, form } = $props();
	const { skus } = data;
	const today = localDate();

	let dateInput = $state(today);
	let balances = $state({ ...data.balances });
	let loadingBalances = $state(false);

	$effect(() => {
		const date = dateInput;
		loadingBalances = true;
		fetch(`/inventory/count/balances?date=${date}`)
			.then((r) => r.json())
			.then((d) => {
				balances = d.balances;
				loadingBalances = false;
			});
	});
</script>

<svelte:head><title>Record Count — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href="/matrix" class="text-gray-400 hover:text-gray-600 text-sm">← Overview</a>
	<h1 class="text-lg font-semibold text-gray-900">Record Inventory Count</h1>
</header>

<main class="p-6 max-w-2xl space-y-6">
	{#if form?.error}
		<p class="text-red-600 text-sm">{form.error}</p>
	{/if}

	{#if form?.preview}
		<!-- Step 2: Confirmation -->
		<div class="card">
			<div class="card-header">
				<span class="font-semibold text-sm text-gray-700">Review changes</span>
			</div>
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50">
						<th class="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Current</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">New Count</th>
						<th class="px-4 py-3 text-right font-medium text-gray-500">Change</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each form.preview as item (item.skuId)}
						<tr>
							<td class="px-4 py-3 font-medium text-gray-900">{item.label}</td>
							<td class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
								>{fmtSqft(item.currentBalance)}</td
							>
							<td class="px-4 py-3 text-right tabular-nums font-mono text-gray-600"
								>{fmtSqft(item.newCount)}</td
							>
							<td class="px-4 py-3 text-right tabular-nums font-mono font-medium">
								{#if item.delta > 0}
									<span class="text-green-600">+{fmtSqft(item.delta)}</span>
								{:else}
									<span class="text-red-600">{fmtSqft(item.delta)}</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="card-body border-t border-gray-100 text-sm text-gray-500 flex gap-6">
				<span>Date: <span class="text-gray-700">{fmtDate(form.countDate)}</span></span>
				{#if form.memo}
					<span>Memo: <span class="text-gray-700">{form.memo}</span></span>
				{/if}
			</div>
		</div>

		<form method="POST" action="?/commit" use:enhance>
			<input type="hidden" name="memo" value={form.memo} />
			<input type="hidden" name="count_date" value={form.countDate} />
			{#each form.preview as item (item.skuId)}
				<input type="hidden" name="sku_id" value={item.skuId} />
				<input type="hidden" name="delta" value={item.delta} />
				<input type="hidden" name="new_count" value={item.newCount} />
			{/each}
			<div class="flex items-center gap-4">
				<button type="submit" class="btn-primary">Confirm & Post</button>
				<a href="/inventory/count" class="text-sm text-gray-500 hover:text-gray-700"
					>Go Back</a
				>
			</div>
		</form>
	{:else}
		<!-- Step 1: Entry -->
		<form method="POST" action="?/preview" use:enhance>
			<div class="grid grid-cols-2 gap-4 mb-4">
				<div>
					<label for="count_date" class="form-label">Count Date</label>
					<input
						id="count_date"
						name="count_date"
						type="date"
						max={today}
						bind:value={dateInput}
						class="form-input"
					/>
				</div>
				<div>
					<label for="memo" class="form-label">Memo</label>
					<input
						id="memo"
						name="memo"
						class="form-input"
						placeholder="e.g. Physical count 2026-04-23"
					/>
				</div>
			</div>

			<div class="card">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700"
						>Enter physical counts — leave blank to skip</span
					>
				</div>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100 bg-gray-50">
							<th class="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
							<th class="px-4 py-3 text-right font-medium text-gray-500"
								>Balance as of {fmtDate(dateInput)}</th
							>
							<th class="px-4 py-3 text-right font-medium text-gray-500"
								>Counted Sq Ft</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each skus as sku (sku.id)}
							<tr>
								<td class="px-4 py-3 font-medium text-gray-900"
									>{sku.display_label}</td
								>
								<td
									class="px-4 py-3 text-right tabular-nums font-mono transition-opacity {loadingBalances
										? 'opacity-40'
										: ''}"
								>
									{#if (balances[sku.id] ?? 0) < 0}
										<span class="sqft-negative"
											>({fmtSqft(Math.abs(balances[sku.id]))})</span
										>
									{:else}
										<span class="text-gray-500"
											>{fmtSqft(balances[sku.id] ?? 0)}</span
										>
									{/if}
								</td>
								<td class="px-4 py-3 text-right">
									<input
										type="number"
										name="count_{sku.id}"
										min="0"
										class="form-input w-32 py-1 text-right tabular-nums"
										placeholder="—"
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-4 flex items-center gap-4">
				<button type="submit" class="btn-primary">Preview Changes</button>
				<a href="/matrix" class="text-sm text-gray-500 hover:text-gray-700">Cancel</a>
			</div>
		</form>
	{/if}
</main>
