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
				form.preview.filter((p) => STATUS[p.status].defaultAccepted).map((p) => p.so_number)
			);
		}
	});

	function toggle(soNum) {
		const next = new Set(accepted);
		next.has(soNum) ? next.delete(soNum) : next.add(soNum);
		accepted = next;
	}
</script>

<svelte:head><title>Import Work Orders — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href="/wo" class="text-gray-400 hover:text-gray-600 text-sm">← Work Orders</a>
	<h1 class="text-lg font-semibold text-gray-900">Import Work Orders</h1>
</header>

<main class="p-6 max-w-4xl space-y-6">
	{#if form?.success}
		<div class="card">
			<div class="card-body space-y-2">
				<p class="text-sm font-semibold text-gray-800">Import complete</p>
				{#if form.created}<p class="text-sm text-gray-600">
						{form.created} work order{form.created !== 1 ? 's' : ''} created.
					</p>{/if}
				{#if form.updated}<p class="text-sm text-gray-600">
						{form.updated} work order{form.updated !== 1 ? 's' : ''} updated.
					</p>{/if}
				<a href="/wo" class="btn-primary btn-sm inline-block mt-2">Back to Work Orders</a>
			</div>
		</div>
	{:else if form?.preview}
		{#if form.error}
			<p class="text-red-600 text-sm">{form.error}</p>
		{/if}
		<form method="POST" action="?/import" use:enhance>
			<input type="hidden" name="csv_data" value={JSON.stringify(form.preview)} />

			<div class="space-y-4">
				{#each form.preview as wo (wo.so_number)}
					{@const s = STATUS[wo.status]}
					<div class="card">
						<div class="card-header flex items-center justify-between">
							<div class="flex items-center gap-3">
								{#if wo.status !== 'unchanged'}
									<input
										type="checkbox"
										id="accept-{wo.so_number}"
										checked={accepted.has(wo.so_number)}
										onchange={() => toggle(wo.so_number)}
										class="rounded border-gray-300"
									/>
								{/if}
								<label
									for="accept-{wo.so_number}"
									class="font-semibold text-sm text-gray-900"
								>
									SO #{wo.so_number}
								</label>
								<span class="badge {s.badge}">{s.label}</span>
							</div>
							<span class="text-sm text-gray-500">
								{wo.customer_name} · {wo.branch} · {fmtDate(wo.ship_date)} · {wo.facing}
							</span>
						</div>
						<div class="card-body p-0">
							<p class="px-4 pt-2 pb-1 text-xs text-gray-500">{wo.job_name}</p>
							<table class="w-full text-xs border-collapse">
								<thead>
									<tr class="border-t border-gray-100 bg-gray-50">
										<th class="px-4 py-1.5 text-left text-gray-500 font-medium"
											>SKU</th
										>
										<th class="px-4 py-1.5 text-right text-gray-500 font-medium"
											>Qty</th
										>
										<th class="px-4 py-1.5 text-right text-gray-500 font-medium"
											>Length</th
										>
										<th class="px-4 py-1.5 text-right text-gray-500 font-medium"
											>Sq Ft</th
										>
										<th class="px-4 py-1.5 text-left text-gray-500 font-medium"
											>Roll For</th
										>
										<th class="px-4 py-1.5 text-left text-gray-500 font-medium"
											>Instructions</th
										>
									</tr>
								</thead>
								<tbody>
									{#each wo.lines as line, i (i)}
										<tr class="border-t border-gray-100">
											<td class="px-4 py-1.5 text-gray-700 font-medium"
												>{line.display_label}</td
											>
											<td
												class="px-4 py-1.5 text-right text-gray-600 tabular-nums"
												>{line.qty}</td
											>
											<td
												class="px-4 py-1.5 text-right text-gray-600 tabular-nums font-mono"
												>{line.length_ft}'</td
											>
											<td
												class="px-4 py-1.5 text-right text-gray-600 tabular-nums font-mono"
												>{fmtSqft(line.sqft)}</td
											>
											<td class="px-4 py-1.5 text-gray-500">{line.rollfor}</td
											>
											<td class="px-4 py-1.5 text-gray-400 italic"
												>{line.instructions}</td
											>
										</tr>
									{/each}
									<tr class="border-t border-gray-200 bg-gray-50">
										<td
											colspan="3"
											class="px-4 py-1.5 text-xs text-gray-500 font-medium"
											>Total</td
										>
										<td
											class="px-4 py-1.5 text-right text-gray-700 tabular-nums font-mono font-medium text-xs"
										>
											{fmtSqft(wo.lines.reduce((s, l) => s + l.sqft, 0))}
										</td>
										<td colspan="2"></td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				{/each}
			</div>

			{#each form.preview as wo (wo.so_number)}
				{#if accepted.has(wo.so_number)}
					<input type="hidden" name="accepted" value={wo.so_number} />
				{/if}
			{/each}

			<div class="flex items-center gap-4 mt-6">
				{#if data.user?.role === 'admin'}
					<button type="submit" class="btn-primary">
						Import {[...accepted].length} work order{accepted.size !== 1 ? 's' : ''}
					</button>
				{:else}
					<p class="text-sm text-amber-700">Admin access required to import.</p>
				{/if}
				<a href="/wo/import" class="text-sm text-gray-500 hover:text-gray-700"
					>Upload different file</a
				>
			</div>
		</form>
	{:else}
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
							<label for="csv" class="form-label">Work order file (.csv)</label>
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
							Expected columns: sonumber, company, jobname, branch, shipdate, facing,
							qty, thickness, width, length, rollfor, instructions
						</p>
						<button type="submit" class="btn-primary btn-sm">Parse & Preview</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</main>
