<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wo, billingLines, productionLines, cutDowns, rawRollLookups } = $derived(data);

	let showScheduleFor = $state(null);
	let vendorFor = $state({});
	let deleteDialog = $state(null);
	let deleteTarget = $state(null);

	const lookupMap = $derived(
		(rawRollLookups ?? []).reduce((m, r) => {
			const v = r.vendor === 'Johns Manville' ? 'JM' : 'CT';
			m[`${r.r_value}_${r.thickness_in}_${r.width_in}_${v}`] = r;
			return m;
		}, {})
	);

	function getVendor(lineId) {
		return vendorFor[lineId] ?? 'JM';
	}

	function setVendor(lineId, v) {
		vendorFor = { ...vendorFor, [lineId]: v };
	}

	function scheduleEnhance(lineId) {
		return () => {
			return async ({ result, update }) => {
				await update();
				if (result.type === 'success') {
					showScheduleFor = null;
					vendorFor = { ...vendorFor, [lineId]: undefined };
				}
			};
		};
	}

	function requestDelete(cutDown) {
		deleteTarget = cutDown;
		deleteDialog.showModal();
	}

	function deleteEnhance() {
		return async ({ update }) => {
			await update();
			deleteDialog.close();
			deleteTarget = null;
		};
	}

	function getRollPreview(line, vendor) {
		const key = `${line.r_value}_${line.thickness_in}_${line.width_in}_${vendor}`;
		const lookup = lookupMap[key];
		if (!lookup) return null;
		const sqftPerRoll = (lookup.width_in / 12) * lookup.roll_length_ft;
		const rolls = Math.ceil(line.sqft / sqftPerRoll);
		const sqft = Math.round(rolls * sqftPerRoll);
		return { rolls, sqft, rollLengthFt: lookup.roll_length_ft };
	}

	const cutDownsByLine = $derived(
		cutDowns.reduce((map, cd) => {
			const k = cd.billing_line_id;
			if (!map[k]) map[k] = [];
			map[k].push(cd);
			return map;
		}, {})
	);

	const childrenByParent = $derived(
		productionLines.reduce((map, pl) => {
			const k = pl.parent_line_id;
			if (!map[k]) map[k] = [];
			map[k].push(pl);
			return map;
		}, {})
	);

	const statusBadge = {
		UNSCHEDULED: 'badge-gray',
		SCHEDULED: 'badge-blue',
		COMPLETED: 'badge-green',
	};
</script>

<svelte:head><title>Cut-Downs - WO {wo.so_number} - PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href="/wo/{wo.id}" class="text-gray-400 hover:text-gray-600 text-sm">← WO {wo.so_number}</a>
	<h1 class="text-lg font-semibold text-gray-900">Cut-Downs</h1>
</header>

<main class="p-6 max-w-5xl space-y-4">
	{#if form?.error}
		<div class="px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
			{form.error}
		</div>
	{/if}

	{#each billingLines as line (line.id)}
		{@const lineCutDowns = cutDownsByLine[line.id] ?? []}
		{@const children = childrenByParent[line.id] ?? []}
		{@const hasActiveCutDown = lineCutDowns.some((cd) => cd.status !== 'COMPLETED')}
		<div class="card">
			<div class="card-header flex items-center justify-between">
				<div class="flex flex-col gap-0.5">
					<div class="flex items-center gap-2 text-sm font-semibold text-gray-700">
						<span class="font-mono"
							>{line.qty} rolls:{line.thickness_in}" × {line.width_in}" × {line.length_ft}'
							{line.facing}
							{line.tab_type}
							</span
						>
						<span class="text-gray-400 font-normal">{fmtSqft(line.sqft)} sqft</span>
					</div>
					{#if children.length > 0}
						<div class="flex flex-col items-end gap-0.5 text-sm text-gray-700">
							{#each children as child (child.id)}
								<span
									>→ {child.width_in}" × {child.length_ft}' ({fmtSqft(child.sqft)} sqft)</span
								>
							{/each}
						</div>
					{/if}
				</div>
				{#if wo.status !== 'COMPLETE' && !hasActiveCutDown}
					<button
						type="button"
						class="btn-secondary btn-sm"
						onclick={() =>
							(showScheduleFor = showScheduleFor === line.id ? null : line.id)}
					>
						{showScheduleFor === line.id ? 'Cancel' : '+ Schedule Cut-Down'}
					</button>
				{:else if hasActiveCutDown}
					<span class="badge-blue text-xs">Cut-Down Scheduled</span>
				{/if}
			</div>

			{#if showScheduleFor === line.id && !hasActiveCutDown}
				<form
					method="POST"
					action="?/scheduleCutDown"
					use:enhance={scheduleEnhance(line.id)}
					class="card-body border-b border-gray-100 space-y-3 text-sm"
				>
					<input type="hidden" name="billingLineId" value={line.id} />
					<div class="grid grid-cols-3 gap-3">
						<div>
							<span class="form-label">Vendor *</span>
							<div class="flex gap-4 mt-1">
								<label class="flex items-center gap-1.5 cursor-pointer">
									<input
										type="radio"
										name="vendor"
										value="JM"
										checked={getVendor(line.id) === 'JM'}
										onchange={() => setVendor(line.id, 'JM')}
									/>
									<span>Johns Manville</span>
								</label>
								<label class="flex items-center gap-1.5 cursor-pointer">
									<input
										type="radio"
										name="vendor"
										value="CT"
										checked={getVendor(line.id) === 'CT'}
										onchange={() => setVendor(line.id, 'CT')}
									/>
									<span>Certainteed</span>
								</label>
							</div>
							{#if getVendor(line.id) === 'CT'}
								<p class="text-amber-600 text-xs mt-1">
									Vendor mixing discouraged.
								</p>
							{/if}
						</div>
						<div>
							<label for="date-{line.id}" class="form-label">Run Date</label>
							<input
								id="date-{line.id}"
								name="runDate"
								type="date"
								class="form-input"
							/>
						</div>
						<div class="flex items-end">
							<button type="submit" class="btn-primary btn-sm">Schedule</button>
						</div>
					</div>
					{#each [getRollPreview(line, getVendor(line.id))] as preview (preview ? `${line.id}-${preview.rollLengthFt}` : `${line.id}-missing`)}
						{#if preview}
							<p class="text-gray-500 text-xs">
								→ {preview.rolls} rolls × {preview.rollLengthFt} ft = {fmtSqft(
									preview.sqft
								)} sqft source
								{#if preview.sqft > line.sqft}
									<span class="text-amber-600"
										>({fmtSqft(preview.sqft - line.sqft)} sqft overage)</span
									>
								{/if}
							</p>
						{:else}
							<p class="text-red-500 text-xs">
								No lookup data for this SKU + vendor. Contact admin.
							</p>
						{/if}
					{/each}
				</form>
			{/if}

			{#if lineCutDowns.length === 0}
				<div class="card-body text-sm text-gray-400">No cut-downs scheduled.</div>
			{:else}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100 bg-gray-50">
							<!-- <th class="px-4 py-2 text-left text-gray-500 font-medium">SKU</th> -->
							<th class="px-4 py-2 text-right text-gray-500 font-medium"
								>Rolls Sched</th
							>
							<th class="px-4 py-2 text-right text-gray-500 font-medium"
								>Sqft Sched</th
							>
							<th class="px-4 py-2 text-left text-gray-500 font-medium">Run Date</th>
							<th class="px-4 py-2 text-left text-gray-500 font-medium">Status</th>
							<th class="px-4 py-2 text-right text-gray-500 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each lineCutDowns as cd (cd.id)}
							<tr class="border-b border-gray-100 last:border-0">
								<!-- <td class="px-4 py-2 text-gray-600">{cd.sku_label}</td> -->
								<td class="px-4 py-2 text-right tabular-nums"
									>{cd.rolls_scheduled}</td
								>
								<td class="px-4 py-2 text-right tabular-nums font-mono"
									>{fmtSqft(cd.sqft_scheduled)}</td
								>
								<td class="px-4 py-2 text-gray-600"
									>{cd.run_date ? fmtDate(cd.run_date) : '-'}</td
								>
								<td class="px-4 py-2">
									<span class={statusBadge[cd.status] ?? 'badge-gray'}
										>{cd.status}</span
									>
								</td>
								<td
									class="px-4 py-2 text-right flex items-center justify-end gap-2"
								>
									<a
										href="/wo/{wo.id}/cutdown/{cd.id}/confirm"
										class="btn-secondary btn-sm"
									>
										{cd.status === 'COMPLETED' ? 'View' : 'Confirm'}
									</a>
									{#if cd.status !== 'COMPLETED'}
										<button
											type="button"
											class="text-red-400 hover:text-red-600 text-xs"
											onclick={() => requestDelete(cd)}>Delete</button
										>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/each}

	{#if billingLines.length === 0}
		<div class="card card-body text-sm text-gray-400">
			No billing lines yet. <a href="/wo/{wo.id}" class="text-blue-600 hover:underline"
				>Branch a line</a
			> first.
		</div>
	{/if}

	<dialog bind:this={deleteDialog} class="modal-dialog modal-dialog-sm">
		<p class="text-sm font-medium text-gray-900 mb-1">Delete scheduled cut-down?</p>
		<p class="text-xs text-gray-500 mb-4">
			{#if deleteTarget?.cut_down_number}
				{deleteTarget.cut_down_number} will be deleted.
			{:else}
				This scheduled cut-down will be deleted.
			{/if}
			This cannot be undone.
		</p>
		<form method="POST" action="?/deleteCutDown" use:enhance={deleteEnhance}>
			<input type="hidden" name="cutDownId" value={deleteTarget?.id ?? ''} />
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					class="btn-secondary btn-sm"
					onclick={() => {
						deleteDialog.close();
						deleteTarget = null;
					}}>Cancel</button
				>
				<button type="submit" class="btn-danger btn-sm">Delete</button>
			</div>
		</form>
	</dialog>
</main>
