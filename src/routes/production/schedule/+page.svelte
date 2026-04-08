<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	let selectedSo = $state(data.preselectSo || '');
	let selectedLine = $state('');
	let sqft = $state('');
	let runDate = $state('');

	let availableLines = $derived(selectedSo ? (data.soLines[selectedSo] ?? []) : []);
	let selectedLineObj = $derived(
		availableLines.find((l) => String(l.id) === String(selectedLine))
	);

	function onLineChange(e) {
		selectedLine = e.target.value;
		const obj = availableLines.find((l) => String(l.id) === e.target.value);
		sqft = obj ? Math.round(obj.sqftUnscheduled) : '';
	}
</script>

<svelte:head><title>Schedule Production Run — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Schedule Production Run</h1>
	<a href="/production" class="btn-secondary btn-sm">Cancel</a>
</header>
<main class="p-6">
	<div class="max-w-lg">
		{#if form?.error}<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>{/if}

		<form method="POST" use:enhance>
			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">Run Details</span>
				</div>
				<div class="card-body space-y-4">
					<div>
						<label class="form-label">Sales Order</label>
						<select
							class="form-select"
							bind:value={selectedSo}
							onchange={() => {
								selectedLine = '';
								sqft = '';
							}}
						>
							<option value="">— select SO —</option>
							{#each data.sos as so}
								<option value={String(so.id)}
									>SO {so.so_number} — {so.job_name}</option
								>
							{/each}
						</select>
					</div>

					{#if selectedSo && availableLines.length}
						<div>
							<label class="form-label">SO Line (SKU)</label>
							<select
								name="so_line_id"
								class="form-select"
								value={selectedLine}
								onchange={onLineChange}
								required
							>
								<option value="">— select line —</option>
								{#each availableLines as line}
									<option value={String(line.id)}
										>{line.display_label} — {Math.round(
											line.sqftUnscheduled
										).toLocaleString()} sqft unscheduled</option
									>
								{/each}
							</select>
						</div>
					{:else if selectedSo}
						<p class="text-sm text-gray-400">
							All lines for this SO are fully scheduled.
						</p>
					{/if}

					{#if selectedLine}
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="form-label"
									>Run Date <span class="text-gray-400 font-normal text-xs"
										>(blank = unscheduled)</span
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
								<label class="form-label">Sq Ft to Schedule</label>
								<input
									type="number"
									name="sqft_scheduled"
									step="1"
									min="1"
									class="form-input font-mono"
									bind:value={sqft}
									required
								/>
								{#if selectedLineObj}
									<p class="text-xs text-gray-400 mt-1">
										Unscheduled: {Math.round(
											selectedLineObj.sqftUnscheduled
										).toLocaleString()} sqft
									</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>

			{#if selectedLine}
				<div class="flex gap-3">
					<button type="submit" class="btn-primary">Schedule Run</button>
					<a href="/production" class="btn-secondary">Cancel</a>
				</div>
			{/if}
		</form>
	</div>
</main>
