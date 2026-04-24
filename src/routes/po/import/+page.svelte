<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();

	const STATUS = {
		new: { label: 'New', badge: 'badge-green', defaultAccepted: true },
		changed: { label: 'Changes', badge: 'badge-amber', defaultAccepted: true },
		unchanged: { label: 'No change', badge: 'badge-gray', defaultAccepted: false },
	};

	let accepted = $state(new Set());
	$effect(() => {
		if (form?.preview) {
			accepted = new Set(
				form.preview.filter((p) => STATUS[p.status].defaultAccepted).map((p) => p.po_number)
			);
		}
	});

	function toggle(poNum) {
		const next = new Set(accepted);
		next.has(poNum) ? next.delete(poNum) : next.add(poNum);
		accepted = next;
	}

	const selectable = $derived(
		(form?.preview ?? []).filter((p) => p.status !== 'unchanged').map((p) => p.po_number)
	);
	const allAccepted = $derived(selectable.length > 0 && selectable.every((n) => accepted.has(n)));
	const someAccepted = $derived(selectable.some((n) => accepted.has(n)) && !allAccepted);
	function toggleAll() {
		accepted = allAccepted ? new Set() : new Set(selectable);
	}
	let masterCb;
	$effect(() => {
		if (masterCb) masterCb.indeterminate = someAccepted;
	});
</script>

<svelte:head><title>Import POs — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href="/po" class="text-gray-400 hover:text-gray-600 text-sm">← Purchase Orders</a>
	<h1 class="text-lg font-semibold text-gray-900">Import POs</h1>
</header>

<main class="p-6 max-w-3xl space-y-6">
	{#if form?.success}
		<div class="card">
			<div class="card-body space-y-2">
				<p class="text-sm font-semibold text-gray-800">Import complete</p>
				{#if form.created}<p class="text-sm text-gray-600">
						{form.created} PO{form.created !== 1 ? 's' : ''} created.
					</p>{/if}
				{#if form.updated}<p class="text-sm text-gray-600">
						{form.updated} PO{form.updated !== 1 ? 's' : ''} updated.
					</p>{/if}
				<a href="/po" class="btn-primary btn-sm inline-block mt-2">Back to POs</a>
			</div>
		</div>
	{:else if form?.preview}
		<!-- Preview + confirm -->
		{#if form.error}
			<p class="text-red-600 text-sm">{form.error}</p>
		{/if}
		<form method="POST" action="?/import" use:enhance>
			<input type="hidden" name="csv_data" value={JSON.stringify(form.preview)} />

			{#if selectable.length > 0}
				<div class="flex items-center gap-2 mb-2">
					<input
						type="checkbox"
						bind:this={masterCb}
						checked={allAccepted}
						onchange={toggleAll}
					/>
					<span class="text-sm text-gray-600">Select all</span>
				</div>
			{/if}
			<div class="space-y-4">
				{#each form.preview as po (po.po_number)}
					{@const s = STATUS[po.status]}
					<div class="card">
						<div class="card-header flex items-center justify-between">
							<div class="flex items-center gap-3">
								{#if po.status !== 'unchanged'}
									<input
										type="checkbox"
										id="accept-{po.po_number}"
										checked={accepted.has(po.po_number)}
										onchange={() => toggle(po.po_number)}
										class="rounded border-gray-300"
									/>
								{/if}
								<label
									for="accept-{po.po_number}"
									class="font-semibold text-sm text-gray-900"
								>
									PO {po.po_number}
								</label>
								<span class="badge {s.badge}">{s.label}</span>
							</div>
							<span class="text-sm text-gray-500"
								>{po.vendor_name} · {fmtDate(po.expected_date)}</span
							>
						</div>

						{#if po.status === 'new'}
							<table class="w-full text-sm border-collapse">
								<tbody>
									{#each po.lines as line (line.sku_code)}
										<tr class="border-t border-gray-100">
											<td class="px-4 py-1.5 text-gray-700"
												>{line.sku_code}</td
											>
											<td
												class="px-4 py-1.5 text-right tabular-nums text-gray-600"
												>{fmtSqft(line.sqft_ordered)} sqft</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						{:else if po.status === 'changed'}
							<!-- TODO(human): implement diff display for changed POs -->
						{:else}
							<div class="card-body text-sm text-gray-400">No changes detected.</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Hidden accepted values driven by $state -->
			{#each form.preview as po (po.po_number)}
				{#if accepted.has(po.po_number)}
					<input type="hidden" name="accepted" value={po.po_number} />
				{/if}
			{/each}

			<div class="flex items-center gap-4 mt-6">
				{#if data.user?.role === 'admin'}
					<button type="submit" class="btn-primary">
						Import {[...accepted].length} PO{accepted.size !== 1 ? 's' : ''}
					</button>
				{:else}
					<p class="text-sm text-amber-700">Admin access required to import.</p>
				{/if}
				<a href="/po/import" class="text-sm text-gray-500 hover:text-gray-700"
					>Upload different file</a
				>
			</div>
		</form>
	{:else}
		<!-- Upload form -->
		{#if form?.error}
			<p class="text-red-600 text-sm">{form.error}</p>
		{/if}
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Upload CSV</span>
			</div>
			<div class="card-body">
				<form method="POST" action="?/parse" enctype="multipart/form-data" use:enhance>
					<div class="space-y-4">
						<div>
							<label for="csv" class="form-label">PO update file (.csv)</label>
							<input
								id="csv"
								name="csv"
								type="file"
								accept=".csv,text/csv"
								required
								class="block w-full text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
							/>
						</div>
						<p class="text-xs text-gray-400">
							Expected columns: Date, PO, Vendor, Item, Quantity
						</p>
						<button type="submit" class="btn-primary btn-sm">Parse & Preview</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</main>
