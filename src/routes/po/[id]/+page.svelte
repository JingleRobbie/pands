<script>
	let { data } = $props();
	const { po, lines } = data;
	function fmtDate(d) {
		return new Date(d).toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}
</script>

<svelte:head><title>PO {po.po_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">PO {po.po_number}</h1>
	<div class="flex gap-2">
		{#if po.status === 'OPEN'}
			<a href="/po/{po.id}/edit" class="btn-secondary btn-sm">Edit</a>
			<a href="/po/{po.id}/receive" class="btn-primary btn-sm">Receive</a>
		{/if}
		<a href="/po" class="btn-secondary btn-sm">Back</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-2xl">
		<div class="card mb-4">
			<div class="card-body grid grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-gray-500">Vendor</span>
					<p class="font-medium mt-0.5">{po.vendor_name}</p>
				</div>
				<div>
					<span class="text-gray-500">Expected</span>
					<p class="font-medium mt-0.5">{fmtDate(po.expected_date)}</p>
				</div>
				<div>
					<span class="text-gray-500">Status</span>
					<p class="mt-0.5">
						{#if po.status === 'OPEN'}<span class="badge-blue">Open</span>
						{:else if po.status === 'RECEIVED'}<span class="badge-green">Received</span>
						{:else}<span class="badge-gray">{po.status}</span>{/if}
					</p>
				</div>
			</div>
		</div>
		<div class="card">
			<div class="card-header">
				<span class="text-sm font-semibold text-gray-700">Lines</span>
			</div>
			<table class="w-full text-sm">
				<thead
					><tr class="border-b border-gray-100">
						<th class="px-4 py-2 text-left text-gray-600">SKU</th>
						<th class="px-4 py-2 text-right text-gray-600">Ordered</th>
						<th class="px-4 py-2 text-right text-gray-600">Received</th>
						<th class="px-4 py-2 text-left text-gray-600">Status</th>
					</tr></thead
				>
				<tbody>
					{#each lines as line}
						<tr class="border-b border-gray-50">
							<td class="px-4 py-2 font-medium">{line.display_label}</td>
							<td class="px-4 py-2 text-right font-mono"
								>{Math.round(line.sqft_ordered).toLocaleString()}</td
							>
							<td class="px-4 py-2 text-right font-mono"
								>{line.sqft_received
									? Math.round(line.sqft_received).toLocaleString()
									: '—'}</td
							>
							<td class="px-4 py-2">
								{#if line.status === 'OPEN'}<span class="badge-blue">Open</span>
								{:else if line.status === 'RECEIVED'}<span class="badge-green"
										>Received</span
									>
								{:else}<span class="badge-gray">{line.status}</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</main>
