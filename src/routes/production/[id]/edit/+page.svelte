<script>
	import { enhance } from '$app/forms';
	import { fmtDate } from '$lib/utils.js';
	let { data, form } = $props();
	const { run, maxRolls, peers } = data;

	let checkedPeerIds = $state(new Set(peers.map((p) => p.id)));
	const allPeersChecked = $derived(peers.every((p) => checkedPeerIds.has(p.id)));
	const somePeersChecked = $derived(
		peers.some((p) => checkedPeerIds.has(p.id)) && !allPeersChecked
	);
	function toggleAllPeers() {
		checkedPeerIds = allPeersChecked ? new Set() : new Set(peers.map((p) => p.id));
	}
	function togglePeer(id) {
		const next = new Set(checkedPeerIds);
		next.has(id) ? next.delete(id) : next.add(id);
		checkedPeerIds = next;
	}
	let masterPeersCb;
	$effect(() => {
		if (masterPeersCb) masterPeersCb.indeterminate = somePeersChecked;
	});

	let runDate = $state(
		run.run_date instanceof Date
			? run.run_date.toISOString().slice(0, 10)
			: run.run_date
				? String(run.run_date).slice(0, 10)
				: ''
	);
	let rollsScheduled = $state(run.rolls_scheduled);
</script>

<svelte:head><title>Edit Run {run.run_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Edit Run {run.run_number}</h1>
	<a href="/production/{run.id}/confirm" class="btn-secondary btn-sm">Cancel</a>
</header>
<main class="p-6">
	<div class="max-w-lg">
		{#if form?.error}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>
		{/if}

		<div class="card mb-4">
			<div class="card-header">
				<span class="font-semibold text-sm text-gray-700">Run Info</span>
			</div>
			<div class="card-body space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-gray-500">Run #</span>
					<span class="font-mono">{run.run_number}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Job</span>
					<span class="font-medium">{run.job_name}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">WO #</span>
					<span>{run.so_number}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">SKU</span>
					<span>{run.display_label}</span>
				</div>
			</div>
		</div>

		<form method="POST" use:enhance>
			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">Schedule</span>
				</div>
				<div class="card-body space-y-4">
					<div>
						<label for="run_date" class="form-label">
							Run Date <span class="text-gray-400 font-normal"
								>(leave blank to unschedule)</span
							>
						</label>
						<input
							id="run_date"
							type="date"
							name="run_date"
							class="form-input"
							bind:value={runDate}
						/>
					</div>
					<div>
						<label for="rolls_scheduled" class="form-label">Rolls Scheduled</label>
						<input
							id="rolls_scheduled"
							type="number"
							name="rolls_scheduled"
							step="1"
							min="1"
							max={maxRolls}
							class="form-input tabular-nums"
							bind:value={rollsScheduled}
							required
						/>
						<p class="text-xs text-gray-400 mt-1">Max available: {maxRolls} rolls</p>
					</div>
				</div>
			</div>

			{#if peers.length > 0}
				<div class="card mb-4">
					<div class="card-header">
						<span class="font-semibold text-sm text-gray-700"
							>Apply to other runs in this group</span
						>
						<span class="text-xs text-gray-400"
							>Date change applies to all checked runs</span
						>
					</div>
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-100">
								<th class="px-4 py-2 w-8">
									<input
										type="checkbox"
										bind:this={masterPeersCb}
										checked={allPeersChecked}
										onchange={toggleAllPeers}
									/>
								</th>
								<th class="px-4 py-2 text-left text-gray-600">SKU</th>
								<th class="px-4 py-2 text-left text-gray-600">Current Date</th>
								<th class="px-4 py-2 text-right text-gray-600">Rolls</th>
							</tr>
						</thead>
						<tbody>
							{#each peers as peer (peer.id)}
								<tr class="border-b border-gray-50">
									<td class="px-4 py-2">
										<input
											type="checkbox"
											name="peer_id"
											value={peer.id}
											id="peer-{peer.id}"
											checked={checkedPeerIds.has(peer.id)}
											onchange={() => togglePeer(peer.id)}
										/>
									</td>
									<td class="px-4 py-2">{peer.display_label}</td>
									<td class="px-4 py-2 text-gray-500">
										{peer.run_date ? fmtDate(peer.run_date) : '—'}
									</td>
									<td class="px-4 py-2 text-right">
										<input
											type="number"
											name="peer_rolls_{peer.id}"
											step="1"
											min="1"
											max={peer.maxRolls}
											class="form-input text-sm text-right tabular-nums w-20"
											value={peer.rolls_scheduled}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<div class="flex gap-3">
				<button type="submit" class="btn-primary">Save Changes</button>
				<a href="/production/{run.id}/confirm" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</main>
