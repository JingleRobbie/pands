<script>
	import { goto } from '$app/navigation';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data } = $props();

	function statusBadge(s) {
		if (s === 'SCHEDULED') return 'badge-blue';
		if (s === 'COMPLETED') return 'badge-green';
		if (s === 'UNSCHEDULED') return 'badge-gray';
		return 'badge-gray';
	}
	function statusLabel(s) {
		return s.charAt(0) + s.slice(1).toLowerCase();
	}
	function tabClass(val) {
		return data.status === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}
	function soRowClass(urgency) {
		if (urgency === 'overdue') return 'border-l-4 border-l-amber-400 bg-amber-50';
		if (urgency === 'today') return 'border-l-4 border-l-blue-400';
		return 'border-l-4 border-l-transparent';
	}
	function soDateClass(urgency) {
		if (urgency === 'overdue') return 'text-amber-600 font-medium';
		if (urgency === 'today') return 'text-blue-600 font-medium';
		return 'text-gray-500';
	}
</script>

<svelte:head><title>Production — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4">
	<h1 class="text-lg font-semibold text-gray-900">Production</h1>
</header>
<main class="p-6 space-y-4">
	<nav class="flex gap-1">
		<a href="/production" class={tabClass('')}>Active</a>
		<a href="/production?status=unscheduled" class={tabClass('unscheduled')}>Unscheduled</a>
		<a href="/production?status=scheduled" class={tabClass('scheduled')}>Scheduled</a>
		<a href="/production?status=completed" class={tabClass('completed')}>Completed</a>
		<a href="/production?status=all" class={tabClass('all')}>All</a>
	</nav>

	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">
				{data.soGroups.length} job{data.soGroups.length === 1 ? '' : 's'}
			</span>
		</div>
		{#if data.soGroups.length}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600 w-28">Date</th>
						<th class="px-4 py-2 text-left text-gray-600 w-36">Customer</th>
						<th class="px-4 py-2 text-left text-gray-600">Job</th>
						<th class="px-4 py-2 text-left text-gray-600 w-24">SO #</th>
						<th class="px-4 py-2 text-left text-gray-600">Runs</th>
						<th class="px-4 py-2 text-right w-24"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.soGroups as so (so.so_id)}
						{@const editRun = so.runs.find((r) => r.status !== 'COMPLETED')}
						{@const hasScheduled = so.runs.some((r) => r.status === 'SCHEDULED')}
						<tr
							class="border-b border-gray-100 cursor-pointer hover:bg-gray-50 align-top {soRowClass(
								so.urgency
							)}"
							onclick={() => goto(`/so/${so.so_id}/confirm`)}
						>
							<td class="px-4 py-3 align-top {soDateClass(so.urgency)}">
								{so.minDate ? fmtDate(so.minDate) : '—'}
							</td>
							<td class="px-4 py-3 align-top text-gray-600">{so.customer_name}</td>
							<td class="px-4 py-3 align-top font-medium text-gray-900"
								>{so.job_name}</td
							>
							<td class="px-4 py-3 align-top text-gray-500">{so.so_number}</td>
							<td class="px-4 py-3 align-top">
								<table class="w-full text-xs">
									<tbody>
										{#each so.runs as run (run.id)}
											<tr>
												<td
													class="pr-4 py-0.5 font-medium text-gray-800 w-24"
													>{run.display_label}</td
												>
												<td class="pr-4 py-0.5 text-gray-500 w-20"
													>{run.facing}</td
												>
												<td
													class="pr-4 py-0.5 font-mono text-gray-600 w-20"
												>
													{fmtSqft(run.sqft_scheduled)}
												</td>
												<td class="py-0.5">
													<span class={statusBadge(run.status)}
														>{statusLabel(run.status)}</span
													>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</td>
							<td
								class="px-4 py-3 align-top text-right"
								onclick={(e) => e.stopPropagation()}
							>
								<div class="flex flex-col items-end gap-1">
									{#if editRun}
										<a
											href="/production/{editRun.id}/edit"
											class="btn-secondary btn-sm">Edit</a
										>
									{/if}
									{#if hasScheduled && data.user?.role === 'admin'}
										<a href="/so/{so.so_id}/confirm" class="btn-primary btn-sm"
											>Confirm</a
										>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-gray-400 text-sm">No production runs found.</div>
		{/if}
	</div>
</main>
