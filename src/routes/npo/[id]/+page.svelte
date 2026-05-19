<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();

	const wo = $derived(data.wo);
	const lines = $derived(data.lines);
	const shipments = $derived(data.shipments);
	const skuMap = $derived(Object.fromEntries(data.skus.map((s) => [String(s.id), s])));

	let addSkuId = $state('');
	let addQty = $state('');
	let addLengthFt = $state('');
	let showAddForm = $state(false);

	const addSku = $derived(skuMap[addSkuId]);
	const addSqft = $derived(() => {
		if (!addSku) return 0;
		const qty = parseInt(addQty);
		const len = parseFloat(addLengthFt);
		if (!qty || !len) return 0;
		return Math.round(qty * (addSku.width_in / 12) * len);
	});

	function statusBadge(s) {
		if (s === 'DRAFT') return 'badge-amber';
		if (s === 'SHIPPED') return 'badge-green';
		return 'badge-gray';
	}
	function woBadge(s) {
		if (s === 'OPEN') return 'badge-blue';
		if (s === 'COMPLETE') return 'badge-green';
		return 'badge-gray';
	}
</script>

<svelte:head><title>NPO {wo.so_number} - PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center gap-4">
	<a href="/npo" class="text-gray-400 hover:text-gray-600 text-sm">- Non-Production Orders</a>
	<h1 class="text-lg font-semibold text-gray-900">NPO {wo.so_number}</h1>
	<span class={woBadge(wo.status)}>{wo.status.charAt(0) + wo.status.slice(1).toLowerCase()}</span>
</header>

<main class="p-6 max-w-4xl space-y-6">
	<div class="card">
		<div class="card-body">
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<p class="form-label">Customer</p>
					<p class="text-gray-900">{wo.customer_display_name ?? wo.customer_name}</p>
				</div>
				<div>
					<p class="form-label">Job Name</p>
					<p class="text-gray-900">{wo.job_name}</p>
				</div>
				<div>
					<p class="form-label">Ship Date</p>
					<p class="text-gray-900">
						{#if wo.ship_asap}<span class="badge-red">ASAP</span>{:else}{fmtDate(wo.ship_date) || '-'}{/if}
					</p>
				</div>
				<div>
					<p class="form-label">Created</p>
					<p class="text-gray-500">{fmtDate(wo.created_at)}</p>
				</div>
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header flex items-center justify-between">
			<span class="text-sm font-semibold text-gray-700">Lines</span>
			<div class="flex items-center gap-3">
				{#if data.unshippedCount > 0 && wo.status === 'OPEN'}
					<a href="/shipments/new?wo={wo.id}" class="btn-primary btn-sm">Create Shipment</a>
				{/if}
				{#if wo.status === 'OPEN'}
					<button
						type="button"
						onclick={() => (showAddForm = !showAddForm)}
						class="btn-secondary btn-sm"
					>{showAddForm ? 'Cancel' : '+ Add Line'}</button>
				{/if}
			</div>
		</div>

		{#if form?.addError}
			<div class="px-4 pt-3"><p class="text-red-600 text-sm">{form.addError}</p></div>
		{/if}
		{#if form?.removeError}
			<div class="px-4 pt-3"><p class="text-red-600 text-sm">{form.removeError}</p></div>
		{/if}

		{#if showAddForm}
			<form method="POST" action="?/addLine" use:enhance class="border-b border-gray-100 px-4 py-3 bg-gray-50">
				<p class="text-xs font-medium text-gray-500 mb-2">Add Line</p>
				<div class="grid grid-cols-[1fr_5rem_6rem_5rem_auto] gap-2 items-end">
					<div>
						<label for="add_sku" class="form-label">SKU</label>
						<select id="add_sku" name="sku_id" bind:value={addSkuId} required class="form-select">
							<option value="">Select SKU...</option>
							{#each data.skus as s (s.id)}
								<option value={String(s.id)}>{s.display_label}{s.pebs ? ' PEBS' : ''}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="add_qty" class="form-label">Qty</label>
						<input id="add_qty" name="qty" type="number" min="1" bind:value={addQty} required class="form-input text-right" />
					</div>
					<div>
						<label for="add_len" class="form-label">Length (ft)</label>
						<input id="add_len" name="length_ft" type="number" min="0.01" step="0.01" bind:value={addLengthFt} required class="form-input text-right font-mono" />
					</div>
					<div>
						<p class="form-label">Sq Ft</p>
						<p class="form-input bg-white text-right font-mono text-gray-600">
							{addSqft() ? fmtSqft(addSqft()) : '-'}
						</p>
					</div>
					<div class="mt-5">
						<button type="submit" class="btn-primary btn-sm">Add</button>
					</div>
				</div>
			</form>
		{/if}

		{#if lines.length}
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50">
						<th class="px-4 py-2 text-left text-gray-500 font-medium">SKU</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Qty</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Length</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Sq Ft</th>
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Shipment</th>
						{#if wo.status === 'OPEN'}<th class="px-4 py-2"></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each lines as line (line.id)}
						<tr class="border-t border-gray-100">
							<td class="px-4 py-2 font-medium text-gray-900">
								{line.display_label}{line.pebs ? ' PEBS' : ''}
							</td>
							<td class="px-4 py-2 text-right tabular-nums text-gray-600">{line.qty}</td>
							<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600">{line.length_ft}'</td>
							<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600">{fmtSqft(line.sqft)}</td>
							<td class="px-4 py-2">
								{#if line.shipment_line_id}
									<a href="/shipments/{line.shipment_id}" class="text-blue-600 hover:underline text-sm">
										{line.shipment_number}
									</a>
									<span class="ml-1 {statusBadge(line.shipment_status)} text-xs">{line.shipment_status}</span>
								{:else}
									<span class="text-gray-400 text-xs">Not shipped</span>
								{/if}
							</td>
							{#if wo.status === 'OPEN'}
								<td class="px-4 py-2">
									{#if !line.shipment_line_id}
										<form method="POST" action="?/removeLine" use:enhance>
											<input type="hidden" name="line_id" value={line.id} />
											<button type="submit" class="text-red-400 hover:text-red-600 text-xs">Remove</button>
										</form>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
					<tr class="border-t border-gray-200 bg-gray-50">
						<td colspan={wo.status === 'OPEN' ? 3 : 3} class="px-4 py-2 text-xs text-gray-500 font-medium">Total</td>
						<td class="px-4 py-2 text-right tabular-nums font-mono font-medium text-gray-700 text-xs">
							{fmtSqft(lines.reduce((s, l) => s + l.sqft, 0))}
						</td>
						<td colspan={wo.status === 'OPEN' ? 2 : 1}></td>
					</tr>
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">No lines yet.</div>
		{/if}
	</div>

	{#if shipments.length}
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Shipments</span>
			</div>
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50">
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Shipment #</th>
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Ship Date</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Lines</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Sq Ft</th>
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each shipments as s (s.id)}
						<tr class="border-t border-gray-100 cursor-pointer" onclick={() => window.location.href = `/shipments/${s.id}`}>
							<td class="px-4 py-2 font-medium text-blue-600">{s.shipment_number}</td>
							<td class="px-4 py-2 text-gray-600">{fmtDate(s.ship_date)}</td>
							<td class="px-4 py-2 text-right text-gray-500">{s.line_count}</td>
							<td class="px-4 py-2 text-right font-mono text-gray-600">{fmtSqft(s.total_sqft)}</td>
							<td class="px-4 py-2">
								<span class={statusBadge(s.status)}>{s.status}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
