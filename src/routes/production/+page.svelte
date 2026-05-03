<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
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
		const current = page.url.searchParams.get('status') ?? '';
		return current === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}
	function woRowClass(urgency) {
		if (urgency === 'overdue') return 'border-l-4 border-l-amber-400 bg-amber-50';
		if (urgency === 'today') return 'border-l-4 border-l-blue-400';
		return 'border-l-4 border-l-transparent';
	}
	function woDateClass(urgency) {
		if (urgency === 'overdue') return 'text-amber-600 font-medium';
		if (urgency === 'today') return 'text-blue-600 font-medium';
		return 'text-gray-500';
	}
</script>

<svelte:head><title>Production — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Production</h1>
	{#if data.user?.role === 'admin'}
		<a href="/production/unproduce" class="btn-secondary btn-sm">Unproduce</a>
	{/if}
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
				{data.woGroups.length} job{data.woGroups.length === 1 ? '' : 's'}
			</span>
		</div>
		{#if data.woGroups.length}
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500 w-28">Date</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500 w-36">Customer</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Job</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500 w-24">WO #</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Runs</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each data.woGroups as wo (wo.wo_id)}
						<tr
							class="cursor-pointer hover:bg-gray-50 align-top {woRowClass(
								wo.urgency
							)}"
							onclick={() => goto(`/wo/${wo.wo_id}/confirm`)}
						>
							<td class="px-4 py-3 align-top {woDateClass(wo.urgency)}">
								{wo.minDate ? fmtDate(wo.minDate) : '—'}
							</td>
							<td class="px-4 py-3 align-top text-gray-600">{wo.customer_name}</td>
							<td class="px-4 py-3 align-top font-medium text-gray-900"
								>{wo.job_name}</td
							>
							<td class="px-4 py-3 align-top text-gray-500">{wo.so_number}</td>
							<td class="px-4 py-3 align-top">
								<table class="w-full text-xs">
									<tbody>
										{#each wo.skuLines as line (`${line.display_label}|||${line.facing}`)}
											<tr>
												<td
													class="pr-4 py-0.5 font-medium text-gray-800 w-24"
													>{line.display_label}</td
												>
												<td class="pr-4 py-0.5 text-gray-500 w-20"
													>{line.facing}</td
												>
												<td
													class="pr-4 py-0.5 tabular-nums text-gray-600 w-16"
												>
													{line.total_rolls} roll{line.total_rolls === 1
														? ''
														: 's'}
												</td>
												<td
													class="pr-4 py-0.5 tabular-nums font-mono text-gray-500 w-20"
												>
													{fmtSqft(line.total_sqft)}
												</td>
												<td class="py-0.5">
													<span class={statusBadge(line.status)}
														>{statusLabel(line.status)}</span
													>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
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
