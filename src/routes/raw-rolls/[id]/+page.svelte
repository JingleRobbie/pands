<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const { roll } = data;
</script>

<svelte:head><title>{roll.vendor} {roll.thickness_in}"×{roll.width_in}" — PandS</title></svelte:head>

<div class="p-6 max-w-md">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">{roll.vendor} — {roll.thickness_in}"×{roll.width_in}"</h1>
		<a href="/raw-rolls" class="btn-secondary btn-sm">← Raw Rolls</a>
	</div>

	<form method="POST" use:enhance class="space-y-4">
		{#if form?.error}<p class="text-red-600 text-sm">{form.error}</p>{/if}
		{#if form?.success}<p class="text-green-600 text-sm">Saved.</p>{/if}

		<div class="card card-body space-y-4">
			<div>
				<label for="vendor" class="form-label">Vendor *</label>
				<select id="vendor" name="vendor" class="form-select">
					<option value="Johns Manville" selected={roll.vendor === 'Johns Manville'}>Johns Manville</option>
					<option value="Certainteed" selected={roll.vendor === 'Certainteed'}>Certainteed</option>
				</select>
			</div>
			<div>
				<label for="r_value" class="form-label">R-Value</label>
				<input id="r_value" name="r_value" class="form-input max-w-xs" value={roll.r_value ?? ''} placeholder="e.g. R-13" />
			</div>
			<label class="flex items-center gap-2 cursor-pointer">
				<input type="checkbox" name="pebs" class="rounded border-gray-300" checked={!!roll.pebs} />
				<span class="text-sm text-gray-700">PEBS</span>
			</label>
			<div class="flex gap-4">
				<div>
					<label for="thickness_in" class="form-label">Thickness (in) *</label>
					<input id="thickness_in" name="thickness_in" type="number" step="0.5" min="0" class="form-input w-24" value={roll.thickness_in} required />
				</div>
				<div>
					<label for="width_in" class="form-label">Width (in) *</label>
					<input id="width_in" name="width_in" type="number" min="1" class="form-input w-24" value={roll.width_in} required />
				</div>
			</div>
			<div>
				<label for="roll_length_ft" class="form-label">Roll Length (ft) *</label>
				<input id="roll_length_ft" name="roll_length_ft" type="number" min="1" class="form-input w-28" value={roll.roll_length_ft} required />
			</div>
		</div>

		<button type="submit" class="btn-primary">Save Changes</button>
	</form>
</div>
