<script>
	import { enhance } from '$app/forms';
	import { fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();

	let lines = $state([{ skuId: '', qty: '', lengthFt: '' }]);
	let shipAsap = $state(false);

	const skuMap = $derived(
		Object.fromEntries(data.skus.map((s) => [String(s.id), s]))
	);

	function calcSqft(line) {
		const sku = skuMap[line.skuId];
		if (!sku) return 0;
		const qty = parseInt(line.qty);
		const len = parseFloat(line.lengthFt);
		if (!qty || !len) return 0;
		return Math.round(qty * (sku.width_in / 12) * len);
	}

	function addLine() {
		lines = [...lines, { skuId: '', qty: '', lengthFt: '' }];
	}
	function removeLine(i) {
		lines = lines.filter((_, idx) => idx !== i);
	}

	const totalSqft = $derived(lines.reduce((s, l) => s + calcSqft(l), 0));
</script>

<svelte:head><title>New Non-Production Order - PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center gap-4">
	<a href="/npo" class="text-gray-400 hover:text-gray-600 text-sm">- Non-Production Orders</a>
	<h1 class="text-lg font-semibold text-gray-900">New NPO</h1>
</header>

<main class="p-6 max-w-4xl space-y-6">
	{#if form?.error}
		<p class="text-red-600 text-sm">{form.error}</p>
	{/if}

	<form method="POST" use:enhance class="space-y-6">
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Order Details</span>
			</div>
			<div class="card-body space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="so_number" class="form-label">SO Number</label>
						<input id="so_number" name="so_number" type="text" required class="form-input" placeholder="e.g. SO-12345" />
					</div>
					<div>
						<label for="customer_id" class="form-label">Customer</label>
						<select id="customer_id" name="customer_id" required class="form-select">
							<option value="">Select customer...</option>
							{#each data.customers as c (c.id)}
								<option value={c.id}>{c.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<div>
					<label for="job_name" class="form-label">Job Name</label>
					<input id="job_name" name="job_name" type="text" required class="form-input" />
				</div>
				<div class="grid grid-cols-2 gap-4 items-end">
					<div>
						<label for="ship_date" class="form-label">Ship Date</label>
						<input id="ship_date" name="ship_date" type="date" class="form-input" disabled={shipAsap} />
					</div>
					<div class="flex items-center gap-2 pb-0.5">
						<input
							id="ship_asap"
							name="ship_asap"
							type="checkbox"
							bind:checked={shipAsap}
							class="h-4 w-4 rounded border-gray-300 text-blue-600"
						/>
						<label for="ship_asap" class="text-sm text-gray-700">Ship ASAP</label>
					</div>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header flex items-center justify-between">
				<span class="text-sm font-semibold text-gray-700">Lines</span>
				<span class="text-sm text-gray-500">{fmtSqft(totalSqft)} sq ft total</span>
			</div>
			<div class="card-body space-y-3 p-4">
				{#each lines as line, i (i)}
					{@const sku = skuMap[line.skuId]}
					{@const sqft = calcSqft(line)}
					<div class="grid grid-cols-[1fr_5rem_6rem_5rem_auto] gap-2 items-end">
						<div>
							{#if i === 0}<label for="sku_{i}" class="form-label">SKU</label>{/if}
							<select
								id="sku_{i}"
								name="sku_id"
								bind:value={line.skuId}
								required
								class="form-select"
							>
								<option value="">Select SKU...</option>
								{#each data.skus as s (s.id)}
									<option value={String(s.id)}>{s.display_label}{s.pebs ? ' PEBS' : ''}</option>
								{/each}
							</select>
							{#if sku}
								<input type="hidden" name="sku_width" value={sku.width_in} />
								<input type="hidden" name="sku_thickness" value={sku.thickness_in} />
							{:else}
								<input type="hidden" name="sku_width" value="" />
								<input type="hidden" name="sku_thickness" value="" />
							{/if}
						</div>
						<div>
							{#if i === 0}<label for="qty_{i}" class="form-label">Qty</label>{/if}
							<input
								id="qty_{i}"
								name="qty"
								type="number"
								min="1"
								bind:value={line.qty}
								required
								class="form-input text-right"
								placeholder="0"
							/>
						</div>
						<div>
							{#if i === 0}<label for="len_{i}" class="form-label">Length (ft)</label>{/if}
							<input
								id="len_{i}"
								name="length_ft"
								type="number"
								min="0.01"
								step="0.01"
								bind:value={line.lengthFt}
								required
								class="form-input text-right font-mono"
								placeholder="0.00"
							/>
						</div>
						<div>
							{#if i === 0}<p class="form-label">Sq Ft</p>{/if}
							<p class="form-input bg-gray-50 text-right font-mono text-gray-600">
								{sqft ? fmtSqft(sqft) : '-'}
							</p>
							<input type="hidden" name="sqft" value={sqft} />
						</div>
						<div class="{i === 0 ? 'mt-5' : ''}">
							{#if lines.length > 1}
								<button
									type="button"
									onclick={() => removeLine(i)}
									class="btn-danger btn-sm"
								>x</button>
							{/if}
						</div>
					</div>
				{/each}
				<button type="button" onclick={addLine} class="btn-secondary btn-sm">+ Add Line</button>
			</div>
		</div>

		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Create NPO</button>
			<a href="/npo" class="btn-secondary">Cancel</a>
		</div>
	</form>
</main>
