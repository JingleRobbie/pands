<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wo, billingLines, cutDowns } = $derived(data);

	let showScheduleFor = $state(null);

	const cutDownsByLine = $derived(
		cutDowns.reduce((map, cd) => {
			const k = cd.billing_line_id;
			if (!map[k]) map[k] = [];
			map[k].push(cd);
			return map;
		}, {})
	);

	const statusBadge = {
		UNSCHEDULED: 'badge-gray',
		SCHEDULED: 'badge-blue',
		COMPLETED: 'badge-green',
	};
</script>

<svelte:head><title>Cut-Downs — WO {wo.so_number} — PandS</title></svelte:head>

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
		<div class="card">
			<div class="card-header flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="font-semibold text-sm text-gray-700"
						>{line.display_label} — {line.width_in}" × {line.length_ft}' — {fmtSqft(
							line.sqft
						)} sqft</span
					>
					{#if Number(line.child_count) === 0}
						<span class="badge-amber">Unbranched</span>
					{/if}
				</div>
				{#if Number(line.child_count) > 0 && wo.status !== 'COMPLETE'}
					<button
						type="button"
						class="btn-secondary btn-sm"
						onclick={() =>
							(showScheduleFor = showScheduleFor === line.id ? null : line.id)}
					>
						{showScheduleFor === line.id ? 'Cancel' : '+ Schedule Cut-Down'}
					</button>
				{/if}
			</div>

			{#if showScheduleFor === line.id}
				<form
					method="POST"
					action="?/scheduleCutDown"
					use:enhance={{ onResult: () => (showScheduleFor = null) }}
					class="card-body border-b border-gray-100 grid grid-cols-3 gap-3 text-sm"
				>
					<input type="hidden" name="billingLineId" value={line.id} />
					<div>
						<label for="rolls-{line.id}" class="form-label">Rolls *</label>
						<input
							id="rolls-{line.id}"
							name="rollsScheduled"
							type="number"
							min="1"
							class="form-input"
							required
						/>
					</div>
					<div>
						<label for="date-{line.id}" class="form-label">Run Date</label>
						<input id="date-{line.id}" name="runDate" type="date" class="form-input" />
					</div>
					<div class="flex items-end">
						<button type="submit" class="btn-primary btn-sm">Schedule</button>
					</div>
				</form>
			{/if}

			{#if lineCutDowns.length === 0}
				<div class="card-body text-sm text-gray-400">No cut-downs scheduled.</div>
			{:else}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100 bg-gray-50">
							<th class="px-4 py-2 text-left text-gray-500 font-medium">Status</th>
							<th class="px-4 py-2 text-left text-gray-500 font-medium">SKU</th>
							<th class="px-4 py-2 text-right text-gray-500 font-medium"
								>Rolls Sched</th
							>
							<th class="px-4 py-2 text-right text-gray-500 font-medium"
								>Sqft Sched</th
							>
							<th class="px-4 py-2 text-left text-gray-500 font-medium">Run Date</th>
							<th class="px-4 py-2 text-right text-gray-500 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each lineCutDowns as cd (cd.id)}
							<tr class="border-b border-gray-100 last:border-0">
								<td class="px-4 py-2">
									<span class={statusBadge[cd.status] ?? 'badge-gray'}
										>{cd.status}</span
									>
								</td>
								<td class="px-4 py-2 text-gray-600">{cd.sku_label}</td>
								<td class="px-4 py-2 text-right tabular-nums"
									>{cd.rolls_scheduled}</td
								>
								<td class="px-4 py-2 text-right tabular-nums font-mono"
									>{fmtSqft(cd.sqft_scheduled)}</td
								>
								<td class="px-4 py-2 text-gray-600"
									>{cd.run_date ? fmtDate(cd.run_date) : '—'}</td
								>
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
										<form method="POST" action="?/deleteCutDown" use:enhance>
											<input type="hidden" name="cutDownId" value={cd.id} />
											<button
												type="submit"
												class="text-red-400 hover:text-red-600 text-xs"
												>Delete</button
											>
										</form>
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
</main>
