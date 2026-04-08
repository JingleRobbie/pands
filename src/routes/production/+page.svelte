<script>
	let { data } = $props();
	function fmtDate(d) {
		if (!d) return '?';
		return new Date(d).toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			timeZone: 'UTC',
		});
	}
	function fmtDateFull(d) {
		return new Date(d).toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}
</script>

<svelte:head><title>Production — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Production</h1>
	<a href="/production/schedule" class="btn-primary btn-sm">Schedule Run</a>
</header>
<main class="p-6 space-y-4">
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700"
				>Today — {fmtDateFull(data.today)}</span
			>
		</div>
		{#if data.todayRuns.length}
			<table class="w-full text-sm">
				<thead
					><tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">Run #</th>
						<th class="px-4 py-2 text-left text-gray-600">Job</th>
						<th class="px-4 py-2 text-left text-gray-600">SO #</th>
						<th class="px-4 py-2 text-left text-gray-600">SKU</th>
						<th class="px-4 py-2 text-right text-gray-600">Sqft</th>
						<th class="px-4 py-2 text-right"></th>
					</tr></thead
				>
				<tbody>
					{#each data.todayRuns as run}
						<tr class="border-b border-gray-50 hover:bg-gray-50">
							<td class="px-4 py-2 font-mono text-xs">{run.run_number}</td>
							<td class="px-4 py-2 font-medium">{run.job_name}</td>
							<td class="px-4 py-2 text-gray-600">{run.so_number}</td>
							<td class="px-4 py-2">{run.display_label}</td>
							<td class="px-4 py-2 text-right font-mono"
								>{Math.round(run.sqft_scheduled).toLocaleString()}</td
							>
							<td class="px-4 py-2 text-right"
								><a href="/production/{run.id}/confirm" class="btn-primary btn-sm"
									>Confirm</a
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">No runs scheduled for today.</div>
		{/if}
	</div>

	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Upcoming</span>
		</div>
		{#if data.upcoming.length}
			<table class="w-full text-sm">
				<thead
					><tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">Date</th>
						<th class="px-4 py-2 text-left text-gray-600">Run #</th>
						<th class="px-4 py-2 text-left text-gray-600">Job</th>
						<th class="px-4 py-2 text-left text-gray-600">SKU</th>
						<th class="px-4 py-2 text-right text-gray-600">Sqft</th>
					</tr></thead
				>
				<tbody>
					{#each data.upcoming as run}
						<tr class="border-b border-gray-50 hover:bg-gray-50">
							<td class="px-4 py-2 text-gray-600">{fmtDate(run.run_date)}</td>
							<td class="px-4 py-2 font-mono text-xs">{run.run_number}</td>
							<td class="px-4 py-2"
								><a href="/production/{run.id}/confirm" class="hover:underline"
									>{run.job_name}</a
								></td
							>
							<td class="px-4 py-2">{run.display_label}</td>
							<td class="px-4 py-2 text-right font-mono"
								>{Math.round(run.sqft_scheduled).toLocaleString()}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">No upcoming runs scheduled.</div>
		{/if}
	</div>
</main>
