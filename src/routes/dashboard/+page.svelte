<script>
	import { enhance } from '$app/forms';
	import { withReturnTo } from '$lib/navigation.js';
	import { fmtDate } from '$lib/utils.js';
	const RETURN = '/dashboard';
	let { data } = $props();
	const {
		overduePos,
		overdueRuns,
		unscheduledRuns,
		overdueCutDowns,
		unscheduledCutDowns,
		overdueShipments,
	} = $derived(data);

	const totalIssues = $derived(
		overduePos.length +
			overdueRuns.length +
			unscheduledRuns.length +
			overdueCutDowns.length +
			unscheduledCutDowns.length +
			overdueShipments.length
	);
</script>

<svelte:head><title>Dashboard - PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center justify-between">
	<div class="flex items-center gap-3">
		<h1 class="text-lg font-semibold text-gray-900">Dashboard</h1>
		{#if totalIssues > 0}
			<span class="badge-red">{totalIssues} item{totalIssues === 1 ? '' : 's'} need attention</span>
		{:else}
			<span class="badge-green">All clear</span>
		{/if}
	</div>
</header>

<main class="p-6 space-y-6 max-w-6xl">

	<!-- Purchase Orders -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Purchase Orders</span>
			{#if overduePos.length > 0}
				<span class="badge-red">{overduePos.length} overdue</span>
			{:else}
				<span class="text-xs text-gray-400">None overdue</span>
			{/if}
		</div>
		{#if overduePos.length > 0}
			<table class="dense-list-table">
				<thead>
					<tr>
						<th class="text-left">PO #</th>
						<th class="text-left">Vendor</th>
						<th class="text-left">Expected</th>
						<th class="text-left">Reschedule</th>
						<th class="text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each overduePos as po (po.id)}
						<tr class="dense-list-row-overdue">
							<td class="font-medium text-gray-900">{po.po_number}</td>
							<td class="text-gray-700">{po.vendor_name}</td>
							<td class="text-amber-700 font-medium">{fmtDate(po.expected_date)}</td>
							<td>
								<form method="POST" action="?/reschedulePo" use:enhance class="flex items-center gap-1">
									<input type="hidden" name="id" value={po.id} />
									<input type="date" name="expected_date" class="form-input w-40 py-0.5 text-xs" required />
									<button type="submit" class="btn-secondary btn-sm">Save</button>
								</form>
							</td>
							<td class="text-right">
								<a href={withReturnTo(`/receiving/${po.id}`, RETURN)} class="btn-secondary btn-sm">Receive</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-sm text-gray-400">No overdue purchase orders.</div>
		{/if}
	</div>

	<!-- Production Runs -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Production Runs</span>
			<div class="flex items-center gap-2">
				{#if overdueRuns.length > 0}
					<span class="badge-red">{overdueRuns.length} overdue</span>
				{/if}
				{#if unscheduledRuns.length > 0}
					<span class="badge-amber">{unscheduledRuns.length} unscheduled</span>
				{/if}
				{#if overdueRuns.length === 0 && unscheduledRuns.length === 0}
					<span class="text-xs text-gray-400">None overdue</span>
				{/if}
			</div>
		</div>
		{#if overdueRuns.length > 0 || unscheduledRuns.length > 0}
			<table class="dense-list-table">
				<thead>
					<tr>
						<th class="text-left">Run #</th>
						<th class="text-left">WO #</th>
						<th class="text-left">Job</th>
						<th class="text-left">Customer</th>
						<th class="text-left">Date</th>
						<th class="text-left">Reschedule</th>
						<th class="text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each overdueRuns as run (run.id)}
						<tr class="dense-list-row-overdue">
							<td class="font-mono text-gray-700">{run.run_number}</td>
							<td class="text-gray-600">{run.so_number}</td>
							<td class="font-medium text-gray-900">{run.job_name}</td>
							<td class="text-gray-600">{run.customer_name ?? '-'}</td>
							<td class="text-amber-700 font-medium">{fmtDate(run.run_date)}</td>
							<td>
								<form method="POST" action="?/rescheduleRun" use:enhance class="flex items-center gap-1">
									<input type="hidden" name="id" value={run.id} />
									<input type="date" name="run_date" class="form-input w-40 py-0.5 text-xs" required />
									<button type="submit" class="btn-secondary btn-sm">Save</button>
								</form>
							</td>
							<td class="text-right">
								<a href={withReturnTo(`/wo/${run.wo_id}`, RETURN)} class="btn-secondary btn-sm">WO</a>
							</td>
						</tr>
					{/each}
					{#if unscheduledRuns.length > 0}
						<tr class="dense-list-section-row">
							<td colspan="7"><span class="dense-list-section-label">Unscheduled</span></td>
						</tr>
						{#each unscheduledRuns as run (run.id)}
							<tr>
								<td class="font-mono text-gray-700">{run.run_number}</td>
								<td class="text-gray-600">{run.so_number}</td>
								<td class="font-medium text-gray-900">{run.job_name}</td>
								<td class="text-gray-600">{run.customer_name ?? '-'}</td>
								<td class="text-gray-400 italic text-xs">
									{run.ship_date ? 'Ship ' + fmtDate(run.ship_date) : '-'}
								</td>
								<td>
									<form method="POST" action="?/rescheduleRun" use:enhance class="flex items-center gap-1">
										<input type="hidden" name="id" value={run.id} />
										<input type="date" name="run_date" class="form-input w-40 py-0.5 text-xs" required />
										<button type="submit" class="btn-secondary btn-sm">Schedule</button>
									</form>
								</td>
								<td class="text-right">
									<a href={withReturnTo(`/wo/${run.wo_id}`, RETURN)} class="btn-secondary btn-sm">WO</a>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-sm text-gray-400">No overdue or unscheduled production runs.</div>
		{/if}
	</div>

	<!-- Cut-Downs -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Cut-Downs</span>
			<div class="flex items-center gap-2">
				{#if overdueCutDowns.length > 0}
					<span class="badge-red">{overdueCutDowns.length} overdue</span>
				{/if}
				{#if unscheduledCutDowns.length > 0}
					<span class="badge-amber">{unscheduledCutDowns.length} unscheduled</span>
				{/if}
				{#if overdueCutDowns.length === 0 && unscheduledCutDowns.length === 0}
					<span class="text-xs text-gray-400">None overdue</span>
				{/if}
			</div>
		</div>
		{#if overdueCutDowns.length > 0 || unscheduledCutDowns.length > 0}
			<table class="dense-list-table">
				<thead>
					<tr>
						<th class="text-left">WO #</th>
						<th class="text-left">Job</th>
						<th class="text-left">Customer</th>
						<th class="text-left">Date</th>
						<th class="text-left">Reschedule</th>
						<th class="text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each overdueCutDowns as cd (cd.id)}
						<tr class="dense-list-row-overdue">
							<td class="text-gray-600">{cd.so_number}</td>
							<td class="font-medium text-gray-900">{cd.job_name}</td>
							<td class="text-gray-600">{cd.customer_name ?? '-'}</td>
							<td class="text-amber-700 font-medium">{fmtDate(cd.run_date)}</td>
							<td>
								<form method="POST" action="?/rescheduleCutDown" use:enhance class="flex items-center gap-1">
									<input type="hidden" name="id" value={cd.id} />
									<input type="date" name="run_date" class="form-input w-40 py-0.5 text-xs" required />
									<button type="submit" class="btn-secondary btn-sm">Save</button>
								</form>
							</td>
							<td class="text-right">
								<a href={withReturnTo(`/wo/${cd.wo_id}/cutdown`, RETURN)} class="btn-secondary btn-sm">Cut-Downs</a>
							</td>
						</tr>
					{/each}
					{#if unscheduledCutDowns.length > 0}
						<tr class="dense-list-section-row">
							<td colspan="6"><span class="dense-list-section-label">Unscheduled</span></td>
						</tr>
						{#each unscheduledCutDowns as cd (cd.id)}
							<tr>
								<td class="text-gray-600">{cd.so_number}</td>
								<td class="font-medium text-gray-900">{cd.job_name}</td>
								<td class="text-gray-600">{cd.customer_name ?? '-'}</td>
								<td class="text-gray-400 italic text-xs">
									{cd.ship_date ? 'Ship ' + fmtDate(cd.ship_date) : '-'}
								</td>
								<td>
									<form method="POST" action="?/rescheduleCutDown" use:enhance class="flex items-center gap-1">
										<input type="hidden" name="id" value={cd.id} />
										<input type="date" name="run_date" class="form-input w-40 py-0.5 text-xs" required />
										<button type="submit" class="btn-secondary btn-sm">Schedule</button>
									</form>
								</td>
								<td class="text-right">
									<a href={withReturnTo(`/wo/${cd.wo_id}/cutdown`, RETURN)} class="btn-secondary btn-sm">Cut-Downs</a>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-sm text-gray-400">No overdue or unscheduled cut-downs.</div>
		{/if}
	</div>

	<!-- Shipments -->
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Shipments</span>
			{#if overdueShipments.length > 0}
				<span class="badge-red">{overdueShipments.length} overdue</span>
			{:else}
				<span class="text-xs text-gray-400">None overdue</span>
			{/if}
		</div>
		{#if overdueShipments.length > 0}
			<table class="dense-list-table">
				<thead>
					<tr>
						<th class="text-left">Shipment #</th>
						<th class="text-left">WO #</th>
						<th class="text-left">Job</th>
						<th class="text-left">Customer</th>
						<th class="text-left">Ship Date</th>
						<th class="text-left">Reschedule</th>
						<th class="text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each overdueShipments as s (s.id)}
						<tr class="dense-list-row-overdue">
							<td class="font-medium text-gray-900">{s.shipment_number}</td>
							<td class="text-gray-600">{s.so_number}</td>
							<td class="text-gray-700">{s.job_name}</td>
							<td class="text-gray-600">{s.customer_name}</td>
							<td class="text-amber-700 font-medium">{fmtDate(s.ship_date)}</td>
							<td>
								<form method="POST" action="?/rescheduleShipment" use:enhance class="flex items-center gap-1">
									<input type="hidden" name="id" value={s.id} />
									<input type="date" name="ship_date" class="form-input w-40 py-0.5 text-xs" required />
									<button type="submit" class="btn-secondary btn-sm">Save</button>
								</form>
							</td>
							<td class="text-right">
								<a href={withReturnTo(`/shipments/${s.id}`, RETURN)} class="btn-secondary btn-sm">View</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="card-body text-sm text-gray-400">No overdue draft shipments.</div>
		{/if}
	</div>

</main>
