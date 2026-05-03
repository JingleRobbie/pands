<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getReturnTo, withReturnTo } from '$lib/navigation.js';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	import { untrack } from 'svelte';
	let { data, form } = $props();
	const wo = $derived(data.wo);
	const schedulableLines = $derived(data.schedulableLines);
	const doneLines = $derived(data.doneLines);
	const returnTo = $derived(getReturnTo(page.url, `/wo/${wo.id}`));
	const woHref = $derived(withReturnTo(`/wo/${wo.id}`, returnTo));

	let rolls = $state(
		untrack(() =>
			Object.fromEntries(data.schedulableLines.map((l) => [l.id, l.rollsUnscheduled]))
		)
	);
	function zeroAll() {
		for (const line of schedulableLines) rolls[line.id] = 0;
	}
</script>

<svelte:head><title>Schedule WO {wo.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href={woHref} class="text-gray-400 hover:text-gray-600 text-sm">Back to WO {wo.so_number}</a>
	<h1 class="text-lg font-semibold text-gray-900">Schedule Production</h1>
</header>

<main class="p-6 max-w-3xl space-y-6">
	{#if form?.error}
		<p class="text-red-600 text-sm">{form.error}</p>
	{/if}

	<div class="card">
		<div class="card-body text-sm text-gray-600 grid grid-cols-3 gap-4">
			<div>
				<p class="form-label">Customer</p>
				<p class="text-gray-900">{wo.customer_name}</p>
			</div>
			<div>
				<p class="form-label">Job</p>
				<p class="text-gray-900">{wo.job_name}</p>
			</div>
			<div>
				<p class="form-label">Ship Date</p>
				<p class="text-gray-900">{fmtDate(wo.ship_date)}</p>
			</div>
		</div>
	</div>

	<form method="POST" use:enhance>
		<input type="hidden" name="return_to" value={returnTo} />
		<div class="card">
			<div class="card-header flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="font-semibold text-sm text-gray-700">Lines to schedule</span>
					<button
						type="button"
						onclick={zeroAll}
						class="text-gray-300 hover:text-gray-500 text-xs">Zero All</button
					>
				</div>
				<div class="flex items-center gap-2">
					<label for="run_date" class="form-label mb-0">Production date</label>
					<input
						id="run_date"
						name="run_date"
						type="date"
						class="form-input py-1 text-sm"
						required
					/>
				</div>
			</div>
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50">
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Roll For</th>
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Facing</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Thickness</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Width</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Length</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Remaining</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium"
							>Rolls to schedule</th
						>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Sq Ft</th>
					</tr>
				</thead>
				<tbody>
					{#each schedulableLines as line (line.id)}
						<tr class="border-b border-gray-100">
							<td class="hidden"
								><input type="hidden" name="line_id" value={line.id} /></td
							>
							<td class="px-4 py-2 text-gray-500">{line.rollfor}</td>
							<td class="px-4 py-2 text-gray-500">{line.facing}</td>
							<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
								>{line.thickness_in}"</td
							>
							<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
								>{line.width_in}"</td
							>
							<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600"
								>{line.length_ft}'</td
							>
							<td class="px-4 py-2 text-right tabular-nums text-gray-600"
								>{line.rollsUnscheduled}</td
							>
							<td class="px-4 py-2 text-right">
								<div class="flex items-center justify-end gap-1">
									<input
										type="number"
										name="rolls"
										min="0"
										max={line.rollsUnscheduled}
										bind:value={rolls[line.id]}
										class="form-input w-20 py-1 text-right tabular-nums"
									/>
									<button
										type="button"
										onclick={() => (rolls[line.id] = 0)}
										class="text-gray-300 hover:text-gray-500 text-xs leading-none"
										title="Clear">← Zero</button
									>
								</div>
							</td>
							<td class="px-4 py-2 text-right tabular-nums font-mono text-gray-600">
								{fmtSqft((rolls[line.id] || 0) * line.sqftPerRoll)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if doneLines.length > 0}
			<p class="text-xs text-gray-400 mt-2">
				{doneLines.length} line{doneLines.length === 1 ? '' : 's'} fully scheduled (hidden).
			</p>
		{/if}

		<div class="flex items-center gap-4 mt-4">
			<button type="submit" class="btn-primary">Schedule runs</button>
			<a href={woHref} class="text-sm text-gray-500 hover:text-gray-700">Cancel</a>
		</div>
	</form>
</main>


