<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { so, schedulableLines, doneLines } = data;
</script>

<svelte:head><title>Schedule {so.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">Schedule {so.so_number}</h1>
		<p class="text-sm text-gray-500 mt-0.5">{so.customer_name} · {so.job_name}</p>
	</div>
	<div class="flex gap-2">
		<a href="/so/{so.id}" class="btn-secondary btn-sm">Show SO</a>
		<a href="/so" class="btn-secondary btn-sm">Back</a>
	</div>
</header>

<main class="p-6">
	<div class="max-w-2xl">
		{#if form?.error}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>
		{/if}

		<div class="card mb-4">
			<div class="card-body grid grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Customer</span>
					<p class="font-medium mt-0.5">{so.customer_name}</p>
				</div>
				<div>
					<span class="text-gray-500">Ship Date</span>
					<p class="font-medium mt-0.5">{fmtDate(so.ship_date)}</p>
				</div>
				<div>
					<span class="text-gray-500">Status</span>
					<p class="mt-0.5">
						{#if so.status === 'OPEN'}<span class="badge-blue">Open</span>
						{:else if so.status === 'IN_PROGRESS'}<span class="badge-amber"
								>In Progress</span
							>
						{:else}<span class="badge-gray">{so.status}</span>{/if}
					</p>
				</div>
			</div>
		</div>

		<form method="POST" use:enhance>
			<div class="card mb-4">
				<div class="card-header">
					<span class="text-sm font-semibold text-gray-700">Lines</span>
				</div>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">SKU</th>
							<th class="px-4 py-2 text-right text-gray-600">Ordered</th>
							<th class="px-4 py-2 text-right text-gray-600">Unscheduled</th>
							<th class="px-4 py-2 text-right text-gray-600">Sq Ft to Schedule</th>
						</tr>
					</thead>
					<tbody>
						{#each schedulableLines as line (line.id)}
							<tr class="border-b border-gray-50">
								<td class="px-4 py-2 font-medium">
									<input type="hidden" name="line_id" value={line.id} />
									{line.display_label}
									{#if line.facing && line.facing !== 'Faced'}
										<span class="text-xs text-gray-400 ml-1">{line.facing}</span
										>
									{/if}
								</td>
								<td class="px-4 py-2 text-right font-mono text-gray-500">
									{fmtSqft(line.sqft_ordered)}
								</td>
								<td class="px-4 py-2 text-right font-mono text-gray-500">
									{fmtSqft(line.sqftUnscheduled)}
								</td>
								<td class="px-4 py-2 text-right">
									<input
										type="number"
										name="sqft"
										step="1"
										min="0"
										max={line.sqftUnscheduled}
										class="form-input text-sm text-right font-mono w-32"
										value={line.sqftUnscheduled}
									/>
								</td>
							</tr>
						{/each}
						{#each doneLines as line (line.id)}
							<tr class="border-b border-gray-50 opacity-50">
								<td class="px-4 py-2 font-medium text-gray-500"
									>{line.display_label}</td
								>
								<td class="px-4 py-2 text-right font-mono text-gray-400">
									{fmtSqft(line.sqft_ordered)}
								</td>
								<td class="px-4 py-2 text-right font-mono text-gray-400">—</td>
								<td class="px-4 py-2 text-right">
									<span class="badge-green">Done</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if schedulableLines.length}
					<div class="card-body border-t border-gray-100 pt-4">
						<label for="run-date" class="form-label">
							Run Date
							<span class="text-gray-400 font-normal text-xs"
								>(blank = unscheduled)</span
							>
						</label>
						<input id="run-date" type="date" name="run_date" class="form-input w-48" />
					</div>
				{/if}
			</div>

			{#if schedulableLines.length}
				<button type="submit" class="btn-primary">Schedule Runs</button>
			{:else}
				<p class="text-sm text-gray-400">All lines for this SO are fully scheduled.</p>
			{/if}
		</form>
	</div>
</main>
