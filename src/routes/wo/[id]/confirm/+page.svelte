<script>
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wo, matrix, user } = data;

	let localRuns = $state(data.runs);
	const scheduledRuns = $derived(localRuns.filter((r) => r.status !== 'COMPLETED'));
	const confirmedRuns = $derived(localRuns.filter((r) => r.status === 'COMPLETED'));

	const groupedScheduled = $derived(() => {
		const groups = [];
		const seen = new Map();
		for (const run of scheduledRuns) {
			const key = run.group_id ?? `solo-${run.id}`;
			if (!seen.has(key)) {
				const group = { key, runs: [] };
				seen.set(key, group);
				groups.push(group);
			}
			seen.get(key).runs.push(run);
		}
		return groups;
	});

	let checkedRunIds = $state(new Set(localRuns.map((r) => r.id)));
	const allChecked = $derived(scheduledRuns.every((r) => checkedRunIds.has(r.id)));
	const someChecked = $derived(scheduledRuns.some((r) => checkedRunIds.has(r.id)) && !allChecked);
	function toggleAllRuns() {
		checkedRunIds = allChecked ? new Set() : new Set(scheduledRuns.map((r) => r.id));
	}
	function toggleRun(id) {
		const next = new Set(checkedRunIds);
		next.has(id) ? next.delete(id) : next.add(id);
		checkedRunIds = next;
	}
	let masterRunsCb;
	$effect(() => {
		if (masterRunsCb) masterRunsCb.indeterminate = someChecked;
	});

	let confirmDeleteId = $state(null);
	let deleteDialog;

	function requestDelete(runId) {
		confirmDeleteId = runId;
		deleteDialog.showModal();
	}

	function toDateInput(d) {
		if (!d) return '';
		return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
	}

	let dates = $state(Object.fromEntries(localRuns.map((r) => [r.id, toDateInput(r.run_date)])));
	let fillDate = $state('');

	function applyDateToAll() {
		if (!fillDate) return;
		for (const key in dates) dates[key] = fillDate;
	}
</script>

<svelte:head><title>Produce WO {wo.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">Record Production — {wo.so_number}</h1>
		<p class="text-sm text-gray-500 mt-0.5">{wo.customer_name} · {wo.job_name}</p>
	</div>
	<a href="/production" class="btn-secondary btn-sm">Back</a>
</header>

<main class="p-6">
	<div class="max-w-4xl">
		{#if form?.error}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>
		{/if}

		{#if form?.success}
			<div class="card mb-4">
				<div class="card-body space-y-2">
					<p class="text-sm font-medium text-gray-800">
						{form.confirmed} run{form.confirmed === 1 ? '' : 's'} produced.
					</p>
					{#if form.shortfalls.length > 0}
						<p class="text-sm text-amber-700">
							{form.shortfalls.length} shortfall run{form.shortfalls.length === 1
								? ''
								: 's'} created:
						</p>
						<ul class="text-sm text-amber-700 list-disc list-inside">
							{#each form.shortfalls as sf (sf.runNumber)}
								<li>
									<span class="font-mono">{sf.runNumber}</span> — {sf.rolls} roll{sf.rolls ===
									1
										? ''
										: 's'}
								</li>
							{/each}
						</ul>
					{/if}
					<a href="/production" class="btn-secondary btn-sm inline-block mt-2"
						>Back to Production</a
					>
				</div>
			</div>
		{/if}

		{#if !form?.success}
			{#if scheduledRuns.length === 0}
				<div class="card">
					<div class="card-body text-sm text-gray-500">
						All production runs for this work order are already completed.
					</div>
				</div>
			{:else}
				<form method="POST" action="?/confirm" use:enhance>
					<div class="card mb-4">
						<div class="card-header">
							<span class="font-semibold text-sm text-gray-700">Runs to Produce</span>
							<span class="text-xs text-gray-400">{scheduledRuns.length} pending</span
							>
							<div class="flex items-center gap-2 ml-auto">
								<label for="fill_date" class="form-label mb-0 text-xs text-gray-500"
									>Apply date to all</label
								>
								<input
									id="fill_date"
									type="date"
									class="form-input py-1 text-sm"
									bind:value={fillDate}
									oninput={applyDateToAll}
								/>
							</div>
						</div>
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-100">
									<th class="px-4 py-2 w-8">
										<input
											type="checkbox"
											bind:this={masterRunsCb}
											checked={allChecked}
											onchange={toggleAllRuns}
										/>
									</th>
									<th class="px-4 py-2 text-left text-gray-600">Roll For</th>
									<th class="px-4 py-2 text-left text-gray-600">Facing</th>
									<th class="px-4 py-2 text-right text-gray-600">Thickness</th>
									<th class="px-4 py-2 text-right text-gray-600">Width</th>
									<th class="px-4 py-2 text-right text-gray-600">Length</th>
									<th class="px-4 py-2 text-left text-gray-600">Date</th>
									<th class="px-4 py-2 text-right text-gray-600">Scheduled</th>
									<th class="px-4 py-2 text-right text-gray-600">Actual Rolls</th>
									<th class="px-4 py-2 w-8"></th>
								</tr>
							</thead>
							<tbody>
								{#each groupedScheduled() as group (group.key)}
									{#if group.runs.length > 1}
										<tr>
											<td
												colspan="10"
												class="px-4 py-1 bg-gray-50 border-y border-gray-200"
											>
												<span
													class="text-xs font-medium text-gray-400 uppercase tracking-wide"
													>Group · {group.runs.length} runs</span
												>
											</td>
										</tr>
									{/if}
									{#each group.runs as run (run.id)}
										<tr
											class="border-b border-gray-50 {group.runs.length > 1
												? 'border-l-2 border-l-indigo-200'
												: ''}"
										>
											<td class="px-4 py-2">
												<input
													type="checkbox"
													name="run_id"
													value={run.id}
													id="confirm-{run.id}"
													checked={checkedRunIds.has(run.id)}
													onchange={() => toggleRun(run.id)}
												/>
											</td>
											<td class="px-4 py-2 text-gray-500">{run.rollfor}</td>
											<td class="px-4 py-2 text-gray-500">{run.facing}</td>
											<td
												class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
												>{run.thickness_in}"</td
											>
											<td
												class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
												>{run.width_in}"</td
											>
											<td
												class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
												>{run.length_ft}'</td
											>
											<td class="px-4 py-2">
												<input
													type="date"
													name="date_{run.id}"
													bind:value={dates[run.id]}
													class="form-input text-sm"
												/>
											</td>
											<td
												class="px-4 py-2 text-right tabular-nums text-gray-500"
											>
												{run.rolls_scheduled} roll{run.rolls_scheduled === 1
													? ''
													: 's'}
											</td>
											<td class="px-4 py-2 text-right">
												<input
													type="number"
													name="rolls_{run.id}"
													value={run.rolls_scheduled}
													min="1"
													max={run.rolls_scheduled}
													step="1"
													class="form-input w-20 text-right tabular-nums"
												/>
											</td>
											<td class="px-4 py-2 text-center">
												{#if user?.role === 'admin'}
													<button
														type="button"
														class="text-gray-300 hover:text-red-500 font-bold leading-none text-lg"
														onclick={() => requestDelete(run.id)}
														>×</button
													>
												{/if}
											</td>
										</tr>
									{/each}
								{/each}
							</tbody>
						</table>
					</div>
					<div class="flex gap-3">
						{#if user?.role === 'admin'}
							<button type="submit" class="btn-primary"
								>Mark Produced &amp; Deduct Inventory</button
							>
						{:else}
							<p class="text-sm text-amber-700">
								Admin access required to confirm runs.
							</p>
						{/if}
						<a href="/production" class="btn-secondary">Cancel</a>
					</div>
				</form>
			{/if}
		{/if}

		{#if confirmedRuns.length > 0}
			<div class="card mt-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">Already Produced</span>
				</div>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">Roll For</th>
							<th class="px-4 py-2 text-left text-gray-600">Facing</th>
							<th class="px-4 py-2 text-right text-gray-600">Thickness</th>
							<th class="px-4 py-2 text-right text-gray-600">Width</th>
							<th class="px-4 py-2 text-right text-gray-600">Length</th>
							<th class="px-4 py-2 text-left text-gray-600">Date</th>
							<th class="px-4 py-2 text-right text-gray-600">Rolls</th>
							<th class="px-4 py-2 text-right text-gray-600">Sq Ft</th>
						</tr>
					</thead>
					<tbody>
						{#each confirmedRuns as run (run.id)}
							<tr class="border-b border-gray-50 text-gray-400">
								<td class="px-4 py-2">{run.rollfor}</td>
								<td class="px-4 py-2">{run.facing}</td>
								<td class="px-4 py-2 text-right tabular-nums font-mono"
									>{run.thickness_in}"</td
								>
								<td class="px-4 py-2 text-right tabular-nums font-mono"
									>{run.width_in}"</td
								>
								<td class="px-4 py-2 text-right tabular-nums font-mono"
									>{run.length_ft}'</td
								>
								<td class="px-4 py-2">{fmtDate(run.run_date)}</td>
								<td class="px-4 py-2 text-right tabular-nums">{run.rolls_actual}</td
								>
								<td class="px-4 py-2 text-right font-mono"
									>{fmtSqft(run.sqft_actual)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<dialog bind:this={deleteDialog} class="rounded-lg shadow-xl p-6 w-80 backdrop:bg-black/30">
		<p class="text-sm font-medium text-gray-900 mb-1">Delete production run?</p>
		<p class="text-xs text-gray-500 mb-4">This cannot be undone.</p>
		<form
			method="POST"
			action="?/remove"
			use:enhance={() => {
				const deletedId = confirmDeleteId;
				return () => {
					localRuns = localRuns.filter((r) => r.id !== deletedId);
					checkedRunIds = new Set([...checkedRunIds].filter((id) => id !== deletedId));
					deleteDialog.close();
					confirmDeleteId = null;
				};
			}}
		>
			<input type="hidden" name="run_id" value={confirmDeleteId} />
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					class="btn-secondary btn-sm"
					onclick={() => {
						deleteDialog.close();
						confirmDeleteId = null;
					}}>Cancel</button
				>
				<button type="submit" class="btn-danger btn-sm">Delete</button>
			</div>
		</form>
	</dialog>

	{#if matrix}
		<div class="card overflow-x-auto mt-6">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Inventory Outlook</span>
			</div>
			<table class="matrix-table w-full text-left border-collapse">
				<thead>
					<tr>
						<th class="min-w-[120px]">Customer/Vendor</th>
						<th class="min-w-[140px]">Description</th>
						<th class="min-w-[90px]">WO #</th>
						<th class="min-w-[70px]">Date</th>
						<th class="min-w-[70px]">Ship</th>
						<th class="min-w-[70px]">Facing</th>
						{#each matrix.skus as sku (sku.id)}
							{@const trimmed = sku.display_label.trim()}
							<th class="sku-col-start min-w-[50px] align-bottom">
								<div class="h-16 relative overflow-visible">
									<span
										class="absolute bottom-1 left-1/2 inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-normal"
									>
										{trimmed} Δ
									</span>
								</div>
							</th>
							<th class="min-w-[80px] align-bottom">
								<div class="h-16 relative overflow-visible">
									<span
										class="absolute bottom-1 left-1/2 inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-normal text-gray-400"
									>
										{trimmed} bal
									</span>
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr class="row-balance">
						<td></td>
						<td class="font-semibold text-gray-700">Current Inventory</td>
						<td></td>
						<td class="text-xs text-gray-500">today</td>
						<td></td>
						<td></td>
						{#each matrix.skus as sku (sku.id)}
							{@const cell = matrix.balanceRow.cells[sku.id]}
							<td class="sku-col-start"></td>
							<td
								class="text-right font-mono text-sm {cell?.runningTotal < 0
									? 'sqft-negative'
									: ''}"
							>
								{fmtSqft(cell?.runningTotal ?? 0)}
							</td>
						{/each}
					</tr>
					{#each matrix.rows as row (row.rowType + (row.runId ?? row.woLineId ?? row.objectId))}
						{@const href =
							row.rowType === 'po'
								? `/po/${row.objectId}`
								: `/wo/${row.objectId}/${row.rowType === 'unscheduled' ? 'schedule' : 'confirm'}`}
						<tr class="row-{row.rowType} cursor-pointer" onclick={() => goto(href)}>
							<td class="text-gray-600 text-sm">{row.partyName ?? ''}</td>
							<td class="font-medium">
								{#if row.rowType === 'po'}
									{@const sc =
										row.status === 'CANCELLED' ? 'badge-red' : 'badge-blue'}
									<span class={sc}>{row.status}</span>
								{:else if row.rowType === 'production'}
									{row.description}
								{:else}
									<span class="text-amber-700">{row.description}</span>
								{/if}
							</td>
							<td
								class="text-sm {row.rowType === 'po'
									? 'text-blue-700'
									: row.rowType === 'unscheduled'
										? 'text-amber-700'
										: 'text-gray-600'}"
							>
								{row.soNumber || row.poNumber}
							</td>
							<td class="text-sm text-gray-600">
								{#if row.eventDate}
									{fmtDate(row.eventDate)}
								{:else if row.rowType === 'unscheduled'}
									<span class="text-amber-600 font-semibold">?</span>
								{/if}
							</td>
							<td class="text-sm text-gray-600">
								{#if row.shipDate}{fmtDate(row.shipDate)}{/if}
							</td>
							<td class="text-sm text-gray-600">{row.facing ?? ''}</td>
							{#each matrix.skus as sku (sku.id)}
								{@const cell = row.cells[sku.id]}
								<td
									class="sku-col-start text-right font-mono text-sm"
									onclick={(e) => e.stopPropagation()}
								>
									{#if cell?.delta != null}
										{#if cell.delta > 0}
											<span class="sqft-positive">+{fmtSqft(cell.delta)}</span
											>
										{:else}
											<span class="sqft-negative"
												>({fmtSqft(Math.abs(cell.delta))})</span
											>
										{/if}
									{/if}
								</td>
								<td
									class="text-right font-mono text-sm {cell?.runningTotal < 0
										? 'sqft-negative'
										: 'text-gray-500'}"
									onclick={(e) => e.stopPropagation()}
								>
									{fmtSqft(cell?.runningTotal ?? 0)}
								</td>
							{/each}
						</tr>
					{:else}
						<tr>
							<td colspan="100" class="py-6 text-center text-gray-400 text-sm">
								No upcoming activity for these SKUs.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
