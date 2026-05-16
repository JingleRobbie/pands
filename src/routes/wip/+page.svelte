<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wipBalances, productionLines } = $derived(data);

	let assigningFor = $state(null); // cut_down_id of open assign form
	let selectedWoId = $state('');
	let selectedLineId = $state('');
	let sqftToAssign = $state('');

	const linesByWo = $derived(
		productionLines.reduce((map, l) => {
			const k = String(l.wo_id);
			if (!map[k]) map[k] = { soNumber: l.so_number, jobName: l.job_name, lines: [] };
			map[k].lines.push(l);
			return map;
		}, {})
	);

	const woOptions = $derived(Object.entries(linesByWo).map(([id, v]) => ({ id, ...v })));

	const linesForSelectedWo = $derived(selectedWoId ? (linesByWo[selectedWoId]?.lines ?? []) : []);
</script>

<svelte:head><title>WIP Ledger — PandS</title></svelte:head>

<header class="page-header px-6 py-4">
	<h1 class="text-lg font-semibold text-gray-900">WIP Ledger — Available Scrap</h1>
</header>

<main class="p-6 max-w-4xl space-y-4">
	{#if form?.error}
		<div class="px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div
			class="px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200"
		>
			Scrap assigned.
		</div>
	{/if}

	{#if wipBalances.length === 0}
		<div class="card card-body text-sm text-gray-400">No saved WIP scrap available.</div>
	{:else}
		<div class="card">
			<div class="card-header">
				<span class="font-semibold text-sm text-gray-700"
					>Available Scrap ({wipBalances.length})</span
				>
			</div>
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50">
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Job</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Width</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium"
							>Balance (sqft)</th
						>
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Cut Date</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each wipBalances as wip (wip.cut_down_id + '-' + wip.width_in)}
						<tr class="border-b border-gray-100 last:border-0">
							<td class="px-4 py-2">
								<p class="font-medium text-gray-800">{wip.so_number}</p>
								<p class="text-xs text-gray-400">{wip.job_name}</p>
							</td>
							<td class="px-4 py-2 text-right font-mono tabular-nums"
								>{wip.width_in}"</td
							>
							<td class="px-4 py-2 text-right font-mono tabular-nums"
								>{fmtSqft(wip.balance)}</td
							>
							<td class="px-4 py-2 text-gray-600"
								>{wip.confirmed_at ? fmtDate(wip.confirmed_at) : '—'}</td
							>
							<td class="px-4 py-2 text-right">
								<button
									type="button"
									class="btn-secondary btn-sm"
									onclick={() => {
										assigningFor =
											assigningFor === wip.cut_down_id
												? null
												: wip.cut_down_id;
										selectedWoId = '';
										selectedLineId = '';
										sqftToAssign = String(wip.balance);
									}}
								>
									{assigningFor === wip.cut_down_id ? 'Cancel' : 'Assign to Line'}
								</button>
							</td>
						</tr>

						{#if assigningFor === wip.cut_down_id}
							<tr class="border-b border-gray-100 bg-blue-50">
								<td colspan="5" class="px-4 py-3">
									<form
										method="POST"
										action="?/assignScrap"
										use:enhance={{
											onResult: () => {
												assigningFor = null;
											},
										}}
										class="flex flex-wrap gap-3 items-end text-sm"
									>
										<input
											type="hidden"
											name="sourceCutDownId"
											value={wip.cut_down_id}
										/>

										<div>
											<label for="wo-{wip.cut_down_id}" class="form-label"
												>Work Order</label
											>
											<select
												id="wo-{wip.cut_down_id}"
												class="form-select text-sm py-1"
												bind:value={selectedWoId}
												onchange={() => (selectedLineId = '')}
											>
												<option value="">— select WO —</option>
												{#each woOptions as wo (wo.id)}
													<option value={wo.id}
														>{wo.soNumber} — {wo.jobName}</option
													>
												{/each}
											</select>
										</div>

										<div>
											<label for="line-{wip.cut_down_id}" class="form-label"
												>Production Line</label
											>
											<select
												id="line-{wip.cut_down_id}"
												name="destinationWoLineId"
												class="form-select text-sm py-1"
												bind:value={selectedLineId}
												disabled={!selectedWoId}
											>
												<option value="">— select line —</option>
												{#each linesForSelectedWo as l (l.id)}
													<option value={l.id}
														>{l.width_in}" × {l.length_ft}' — {fmtSqft(
															l.sqft
														)}</option
													>
												{/each}
											</select>
										</div>

										<div>
											<label for="sqft-{wip.cut_down_id}" class="form-label"
												>Sqft to Assign</label
											>
											<input
												id="sqft-{wip.cut_down_id}"
												name="sqftToAssign"
												type="number"
												min="1"
												max={wip.balance}
												class="form-input w-28 text-sm py-1"
												bind:value={sqftToAssign}
											/>
										</div>

										<button
											type="submit"
											class="btn-primary btn-sm"
											disabled={!selectedLineId || !sqftToAssign}
										>
											Assign Scrap
										</button>
									</form>

									{#if selectedLineId}
										{@const destLine = linesForSelectedWo.find(
											(l) => String(l.id) === String(selectedLineId)
										)}
										{#if destLine && Number(wip.width_in) !== Number(destLine.width_in)}
											<p class="mt-2 text-xs text-amber-700">
												⚠ Width mismatch: scrap is {wip.width_in}",
												destination requires {destLine.width_in}".
												{Number(wip.width_in) > Number(destLine.width_in)
													? `${Number(wip.width_in) - Number(destLine.width_in)}" overage — within tolerance, no additional cutting.`
													: 'Scrap is too narrow — assignment will be blocked.'}
											</p>
										{/if}
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
