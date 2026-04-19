<script>
	import { enhance } from '$app/forms';
	import { fmtDate } from '$lib/utils.js';
	let { data, form } = $props();

	const STATUS_BADGE = {
		SCHEDULED: 'badge-blue',
		COMPLETED: 'badge-green',
	};

	function scheduleEnhance({ formElement }) {
		return async ({ update }) => {
			await update();
			formElement.reset();
		};
	}

	let pendingDelete = $state(null);

	function deleteEnhance() {
		return async ({ update }) => {
			await update();
			pendingDelete = null;
		};
	}
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
						<th class="pb-2 pr-4 font-medium">WO</th>
						<th class="pb-2 pr-4 font-medium">SKU</th>
						<th class="pb-2 pr-4 font-medium">Facing</th>
						<th class="pb-2 pr-4 font-medium text-right">Rolls</th>
						<th class="pb-2 pr-4 font-medium">Status</th>
						<th class="pb-2 font-medium"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.runs as run (run.id)}
						<tr class="border-b border-gray-100">
							<td class="py-2 pr-4">{run.customer_name}</td>
							<td class="py-2 pr-4 text-gray-600">{run.job_name}</td>
							<td class="py-2 pr-4">{run.so_number}</td>
							<td class="py-2 pr-4 text-gray-600">{run.sku_label}</td>
							<td class="py-2 pr-4 text-gray-500">{run.facing}</td>
							<td class="py-2 pr-4 text-right tabular-nums">
								{#if run.status === 'COMPLETED'}
									{run.rolls_actual}
								{:else}
									{run.rolls_scheduled}
								{/if}
							</td>
							<td class="py-2 pr-4">
								<span class="badge {STATUS_BADGE[run.status] ?? 'badge-gray'}"
									>{run.status}</span
								>
							</td>
							<td class="py-2">
								{#if run.status === 'SCHEDULED' && data.user?.role === 'admin'}
									<button
										type="button"
										class="btn-danger btn-sm"
										onclick={() => (pendingDelete = run)}
									>
										Delete
									</button>
								{/if}
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
			<p class="text-sm text-gray-400">All open WO lines are fully scheduled.</p>
		{:else}
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="text-left text-xs text-gray-500 border-b border-gray-200">
						<th class="pb-2 pr-4 font-medium">WO</th>
						<th class="pb-2 pr-4 font-medium">Customer</th>
						<th class="pb-2 pr-4 font-medium">Job</th>
						<th class="pb-2 pr-4 font-medium">SKU</th>
						<th class="pb-2 pr-4 font-medium">Facing</th>
						<th class="pb-2 pr-4 font-medium text-right">Remaining Rolls</th>
						<th class="pb-2 font-medium">Schedule</th>
					</tr>
				</thead>
				<tbody>
					{#each data.available as wol (wol.id)}
						{@const remaining = wol.qty - wol.rolls_produced - wol.rolls_in_runs}
						<tr class="border-b border-gray-100">
							<td class="py-2 pr-4">{wol.so_number}</td>
							<td class="py-2 pr-4">{wol.customer_name}</td>
							<td class="py-2 pr-4 text-gray-600">{wol.job_name}</td>
							<td class="py-2 pr-4 text-gray-600">{wol.sku_label}</td>
							<td class="py-2 pr-4 text-gray-500">{wol.facing}</td>
							<td class="py-2 pr-4 text-right tabular-nums">{remaining}</td>
							<td class="py-2">
								<form
									method="POST"
									action="?/schedule"
									use:enhance={scheduleEnhance}
									class="flex items-center gap-2"
								>
									<input type="hidden" name="wo_line_id" value={wol.id} />
									<input
										type="number"
										name="rolls"
										required
										min="1"
										max={remaining}
										placeholder="rolls"
										class="form-input w-20 py-1 text-sm"
									/>
									<button type="submit" class="btn-primary btn-sm"
										>Schedule</button
									>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</main>

{#if pendingDelete}
	<div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
			<h3 class="text-base font-semibold text-gray-900 mb-1">Delete run?</h3>
			<p class="text-sm text-gray-600 mb-1">
				{pendingDelete.so_number} — {pendingDelete.customer_name}
			</p>
			<p class="text-sm text-gray-500 mb-6">
				{pendingDelete.sku_label} · {pendingDelete.rolls_scheduled} roll{pendingDelete.rolls_scheduled ===
				1
					? ''
					: 's'} will be unscheduled.
			</p>
			<div class="flex justify-end gap-3">
				<button
					type="button"
					class="btn-secondary btn-sm"
					onclick={() => (pendingDelete = null)}
				>
					Cancel
				</button>
				<form method="POST" action="?/delete" use:enhance={deleteEnhance}>
					<input type="hidden" name="run_id" value={pendingDelete.id} />
					<button type="submit" class="btn-danger btn-sm">Delete</button>
				</form>
			</div>
		</div>
	</div>
{/if}
