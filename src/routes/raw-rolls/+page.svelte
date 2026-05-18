<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	let { data } = $props();
	const isAdmin = data.appUser?.role === 'admin';
	const created = $derived($page.url.searchParams.get('created'));
</script>

<svelte:head><title>Raw Roll Lookup — PandS</title></svelte:head>

<div class="p-6">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">Raw Roll Lookup</h1>
		{#if isAdmin}
			<a href="/raw-rolls/new" class="btn-primary">Add Entry</a>
		{/if}
	</div>

	{#if created}
		<div class="mb-4 px-4 py-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
			Entry added.
		</div>
	{/if}

	<div class="card overflow-x-auto">
		<table class="dense-list-table min-w-[32rem]">
			<thead>
				<tr>
					<th>Thickness</th>
					<th>Width</th>
					<th>R-Value</th>
					<th>PEBS</th>
					<th>Roll Length</th>
					<th>Vendor</th>
				</tr>
			</thead>
			<tbody>
				{#each data.rolls as roll (roll.id)}
					<tr
						class={isAdmin ? 'cursor-pointer' : ''}
						onclick={isAdmin ? () => goto(`/raw-rolls/${roll.id}`) : undefined}
					>
						<td class="font-medium text-gray-900">{roll.thickness_in}"</td>
						<td class="text-gray-600">{roll.width_in}"</td>
						<td class="text-gray-600">{roll.r_value ?? '—'}</td>
						<td>
							{#if roll.pebs}
								<span class="badge badge-blue">PEBS</span>
							{:else}
								<span class="text-gray-400">—</span>
							{/if}
						</td>
						<td class="text-gray-600">{roll.roll_length_ft} ft</td>
						<td class="text-gray-600">{roll.vendor}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
