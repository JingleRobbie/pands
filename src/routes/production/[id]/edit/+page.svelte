<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const { run, maxSqft } = data;

	let runDate = $state(
		run.run_date instanceof Date
			? run.run_date.toISOString().slice(0, 10)
			: run.run_date
				? String(run.run_date).slice(0, 10)
				: ''
	);
	let sqftScheduled = $state(run.sqft_scheduled);
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
					<span class="text-gray-500">SO #</span>
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
						<label class="form-label"
							>Run Date <span class="text-gray-400 font-normal"
								>(leave blank to unschedule)</span
							></label
						>
						<input
							type="date"
							name="run_date"
							class="form-input"
							bind:value={runDate}
						/>
					</div>
					<div>
						<label class="form-label">Sq Ft Scheduled</label>
						<input
							type="number"
							name="sqft_scheduled"
							step="1"
							min="1"
							max={maxSqft}
							class="form-input font-mono"
							bind:value={sqftScheduled}
							required
						/>
						<p class="text-xs text-gray-400 mt-1">
							Max available: {maxSqft.toLocaleString()} sqft
						</p>
					</div>
				</div>
			</div>

			<div class="flex gap-3">
				<button type="submit" class="btn-primary">Save Changes</button>
				<a href="/production/{run.id}/confirm" class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</main>
