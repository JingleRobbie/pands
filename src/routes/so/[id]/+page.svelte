<script>
	let { data } = $props();
	const { so, lineData } = data;
	function fmtDate(d) {
		if (!d) return '?';
		return new Date(d).toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			timeZone: 'UTC',
		});
	}
</script>

<svelte:head><title>SO {so.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">SO {so.so_number} — {so.job_name}</h1>
	<div class="flex gap-2">
		<a href="/production/schedule?so={so.id}" class="btn-primary btn-sm">Schedule Run</a>
		<a href="/so" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-3xl space-y-3">
		<div class="card">
			<div class="card-body grid grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Ship Date</span>
					<p class="font-medium mt-0.5">
						{new Date(so.ship_date).toLocaleDateString('en-US', {
							month: 'numeric',
							day: 'numeric',
							year: 'numeric',
							timeZone: 'UTC',
						})}
					</p>
				</div>
				<div>
					<span class="text-gray-500">Status</span>
					<p class="mt-0.5">
						{#if so.status === 'OPEN'}<span class="badge-blue">Open</span>
						{:else if so.status === 'IN_PROGRESS'}<span class="badge-amber"
								>In Progress</span
							>
						{:else if so.status === 'COMPLETE'}<span class="badge-green">Complete</span>
						{:else}<span class="badge-gray">{so.status}</span>{/if}
					</p>
				</div>
			</div>
		</div>

		{#each lineData as item}
			<div class="card">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-800"
						>{item.line.display_label}</span
					>
					<div class="flex items-center gap-4 text-xs text-gray-500">
						<span
							>Ordered: <strong class="text-gray-800 font-mono"
								>{Math.round(item.line.sqft_ordered).toLocaleString()}</strong
							> sqft</span
						>
						<span
							>Produced: <strong class="text-gray-800 font-mono"
								>{Math.round(item.line.sqft_produced).toLocaleString()}</strong
							> sqft</span
						>
						{#if item.sqftUnscheduled > 0}
							<span class="text-amber-700"
								>Unscheduled: <strong class="font-mono"
									>{Math.round(item.sqftUnscheduled).toLocaleString()}</strong
								> sqft</span
							>
						{:else}
							<span class="text-green-700">Fully scheduled</span>
						{/if}
					</div>
				</div>
				{#if item.runs.length}
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-gray-100">
								<th class="px-4 py-1.5 text-left text-gray-500">Run #</th>
								<th class="px-4 py-1.5 text-left text-gray-500">Date</th>
								<th class="px-4 py-1.5 text-right text-gray-500">Sqft</th>
								<th class="px-4 py-1.5 text-left text-gray-500">Status</th>
							</tr></thead
						>
						<tbody>
							{#each item.runs as run}
								<tr class="border-b border-gray-50">
									<td class="px-4 py-1.5 font-mono">{run.run_number}</td>
									<td class="px-4 py-1.5">{fmtDate(run.run_date)}</td>
									<td class="px-4 py-1.5 text-right font-mono"
										>{Math.round(run.sqft_scheduled).toLocaleString()}</td
									>
									<td class="px-4 py-1.5">
										{#if run.status === 'SCHEDULED'}<span class="badge-blue"
												>Scheduled</span
											>
										{:else}<span class="badge-amber">Unscheduled</span>{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/each}
	</div>
</main>
