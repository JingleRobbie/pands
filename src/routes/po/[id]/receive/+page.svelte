<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
</script>

<svelte:head><title>Receive PO {data.po.po_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Receive PO {data.po.po_number}</h1>
	<a href="/po/{data.po.id}" class="btn-secondary btn-sm">Cancel</a>
</header>
<main class="p-6">
	<div class="max-w-xl">
		<p class="text-sm text-gray-500 mb-4">
			Enter actual sq ft received. Leave blank to skip a line.
		</p>
		<form method="POST" use:enhance>
			<div class="card mb-4">
				<table class="w-full text-sm">
					<thead
						><tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">SKU</th>
							<th class="px-4 py-2 text-right text-gray-600">Ordered</th>
							<th class="px-4 py-2 text-right text-gray-600">Received (sq ft)</th>
						</tr></thead
					>
					<tbody>
						{#each data.lines as line (line.id)}
							<tr class="border-b border-gray-50">
								<td class="px-4 py-2 font-medium">{line.display_label}</td>
								<td class="px-4 py-2 text-right font-mono text-gray-500"
									>{Math.round(line.sqft_ordered).toLocaleString()}</td
								>
								<td class="px-4 py-2">
									<input
										type="number"
										name="sqft_{line.id}"
										step="1"
										min="0"
										value={Math.round(line.sqft_ordered)}
										class="form-input text-sm text-right font-mono w-full"
									/>
								</td>
							</tr>
						{:else}
							<tr
								><td colspan="3" class="px-4 py-4 text-gray-400 text-sm text-center"
									>All lines already received.</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
			{#if data.lines.length}
				<div class="flex gap-3">
					<button type="submit" class="btn-primary">Confirm Receipt</button>
					<a href="/po/{data.po.id}" class="btn-secondary">Cancel</a>
				</div>
			{:else}
				<a href="/po/{data.po.id}" class="btn-secondary">Back to PO</a>
			{/if}
		</form>
	</div>
</main>
