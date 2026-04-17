<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();

	const STATUS_BADGE = {
		SCHEDULED: 'badge-blue',
		COMPLETED: 'badge-green',
	};
</script>

<svelte:head><title>{fmtDate(data.date)} Schedule — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
	<a href="/calendar" class="text-gray-400 hover:text-gray-600 text-sm">← Calendar</a>
	<h1 class="text-lg font-semibold text-gray-900">{fmtDate(data.date)}</h1>
</header>

<main class="p-6 space-y-8">
	{#if form?.error}
		<p class="text-red-600 text-sm">{form.error}</p>
	{/if}

	<!-- Scheduled runs -->
	<section>
		<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Scheduled</h2>
		{#if data.runs.length === 0}
			<p class="text-sm text-gray-400">No runs scheduled for this day.</p>
		{:else}
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="text-left text-xs text-gray-500 border-b border-gray-200">
						<th class="pb-2 pr-4 font-medium">Customer</th>
						<th class="pb-2 pr-4 font-medium">Job</th>
						<th class="pb-2 pr-4 font-medium">SO</th>
						<th class="pb-2 pr-4 font-medium">SKU</th>
						<th class="pb-2 pr-4 font-medium text-right">Sqft</th>
						<th class="pb-2 font-medium">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.runs as run (run.id)}
						<tr class="border-b border-gray-100">
							<td class="py-2 pr-4">{run.customer_name}</td>
							<td class="py-2 pr-4 text-gray-600">{run.job_name}</td>
							<td class="py-2 pr-4">{run.so_number}</td>
							<td class="py-2 pr-4 text-gray-600">{run.sku_label}</td>
							<td class="py-2 pr-4 text-right tabular-nums">
								{#if run.status === 'COMPLETED'}
									{fmtSqft(run.sqft_actual)}
								{:else}
									{fmtSqft(run.sqft_scheduled)}
								{/if}
							</td>
							<td class="py-2">
								<span class="badge {STATUS_BADGE[run.status] ?? 'badge-gray'}"
									>{run.status}</span
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<!-- Available to schedule -->
	<section>
		<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
			Available to Schedule
		</h2>
		{#if data.available.length === 0}
			<p class="text-sm text-gray-400">All open SO lines are fully scheduled.</p>
		{:else}
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="text-left text-xs text-gray-500 border-b border-gray-200">
						<th class="pb-2 pr-4 font-medium">SO</th>
						<th class="pb-2 pr-4 font-medium">Customer</th>
						<th class="pb-2 pr-4 font-medium">Job</th>
						<th class="pb-2 pr-4 font-medium">SKU</th>
						<th class="pb-2 pr-4 font-medium text-right">Remaining</th>
						<th class="pb-2 font-medium">Schedule</th>
					</tr>
				</thead>
				<tbody>
					{#each data.available as sol (sol.id)}
						<tr class="border-b border-gray-100">
							<td class="py-2 pr-4">{sol.so_number}</td>
							<td class="py-2 pr-4">{sol.customer_name}</td>
							<td class="py-2 pr-4 text-gray-600">{sol.job_name}</td>
							<td class="py-2 pr-4 text-gray-600">{sol.sku_label}</td>
							<td class="py-2 pr-4 text-right tabular-nums">
								{#if sol.status === 'COMPLETED'}
									{fmtSqft(sol.sqft_actual)}
								{:else}
									{fmtSqft(sol.sqft_scheduled)}
								{/if}
							</td>
							<td class="py-2">
								<span class="badge {STATUS_BADGE[sol.status] ?? 'badge-gray'}"
									>{sol.status}</span
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</main>
