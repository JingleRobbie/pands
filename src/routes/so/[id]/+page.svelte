<script>
	import MatrixDrawer from '$lib/components/MatrixDrawer.svelte';
	import { fmtDate } from '$lib/utils.js';
	let { data } = $props();
	const so = $derived(data.so);
	const lineData = $derived(data.lineData);
	const matrix = $derived(data.matrix);
	const woId = $derived(data.woId);
	let outlookOpen = $state(false);
</script>

<svelte:head><title>SO {so.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">SO {so.so_number} — {so.job_name}</h1>
	<div class="flex gap-2">
		{#if so.status === 'OPEN' || so.status === 'IN_PROGRESS'}
			<a href="/so/{so.id}/edit" class="btn-secondary btn-sm">Edit</a>
		{/if}
		{#if woId && (so.status === 'OPEN' || so.status === 'IN_PROGRESS')}
			<a href="/wo/{woId}/schedule" class="btn-primary btn-sm">Schedule</a>
		{/if}
		<button onclick={() => (outlookOpen = !outlookOpen)} class="btn-secondary btn-sm"
			>Inventory Outlook</button
		>
		<a href="/so" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-3xl space-y-3">
		<div class="card">
			<div class="card-body grid grid-cols-4 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Customer</span>
					<p class="font-medium mt-0.5">{so.customer_name}</p>
				</div>
				<div>
					<span class="text-gray-500">Ship Date</span>
					<p class="font-medium mt-0.5">
						{fmtDate(so.ship_date)}
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

		{#each lineData as item (item.line.id)}
			<div class="card">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-800"
						>{item.line.display_label}</span
					>
					<div class="flex items-center gap-4 text-xs text-gray-500">
						<span class="text-gray-600">{item.line.facing}</span>
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
								<th class="px-4 py-1.5 text-left text-gray-500">Date</th>
								<th class="px-4 py-1.5 text-right text-gray-500">Sqft</th>
								<th class="px-4 py-1.5 text-left text-gray-500">Status</th>
							</tr></thead
						>
						<tbody>
							{#each item.runs as run (run.id)}
								<tr class="border-b border-gray-50">
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

	<MatrixDrawer {matrix} bind:open={outlookOpen} />
</main>
