<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	function fmtDate(d) { if (!d) return 'Unscheduled'; return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
</script>
<svelte:head><title>Confirm Run — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Confirm Production Run</h1>
	<a href="/production" class="btn-secondary btn-sm">Back</a>
</header>
<main class="p-6"><div class="max-w-lg">

	{#if data.run.status === 'CONFIRMED'}
	<div class="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200">
		This run has already been confirmed.
	</div>
	{/if}

	{#if form?.error}<div class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">{form.error}</div>{/if}

	<div class="card mb-4">
		<div class="card-header"><span class="font-semibold text-sm text-gray-700">Run Details</span></div>
		<div class="card-body space-y-2 text-sm">
			<div class="flex justify-between">
				<span class="text-gray-500">Run #</span>
				<span class="font-mono">{data.run.run_number}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-gray-500">Job</span>
				<span class="font-medium">{data.run.job_name}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-gray-500">SO #</span>
				<span>{data.run.so_number}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-gray-500">SKU</span>
				<span>{data.run.display_label}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-gray-500">Run Date</span>
				<span>{fmtDate(data.run.run_date)}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-gray-500">Scheduled Sqft</span>
				<span class="font-mono">{Math.round(data.run.sqft_scheduled).toLocaleString()}</span>
			</div>
		</div>
	</div>

	{#if data.run.status !== 'CONFIRMED'}
	<form method="POST" use:enhance>
		<div class="card mb-4">
			<div class="card-header"><span class="font-semibold text-sm text-gray-700">Actual Production</span></div>
			<div class="card-body">
				<label class="form-label">Actual Sq Ft Produced</label>
				<input type="number" name="sqft_actual" step="1" min="1"
					class="form-input font-mono" value={data.run.sqft_scheduled} required />
				<p class="text-xs text-gray-400 mt-1">This will deduct from inventory and close the run.</p>
			</div>
		</div>
		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Confirm &amp; Deduct Inventory</button>
			<a href="/production" class="btn-secondary">Cancel</a>
		</div>
	</form>
	{/if}

</div></main>
