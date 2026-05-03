<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getReturnTo, withReturnTo } from '$lib/navigation.js';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const po = $derived(data.po);
	const openLines = $derived(data.openLines);
	const doneLines = $derived(data.doneLines);
	const returnTo = $derived(getReturnTo(page.url, '/receiving'));
	let receiveDialog = $state(null);
	let allowReceiveSubmit = $state(false);

	function requestReceive(formElement) {
		if (formElement && !formElement.reportValidity()) return;
		receiveDialog.showModal();
	}

	function handleReceiveSubmit(event) {
		if (!allowReceiveSubmit) {
			event.preventDefault();
			requestReceive(event.currentTarget);
			return;
		}
		allowReceiveSubmit = false;
	}

	function receiveEnhance() {
		return async ({ update }) => {
			receiveDialog?.close();
			await update();
		};
	}
</script>

<svelte:head><title>Receive PO {po.po_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">Receive PO {po.po_number}</h1>
		<p class="text-sm text-gray-500 mt-0.5">{po.vendor_name}</p>
	</div>
	<div class="flex gap-2">
		<a href={withReturnTo(`/po/${po.id}`, returnTo)} class="btn-secondary btn-sm">Show PO</a>
		<a href={returnTo} class="btn-secondary btn-sm">Back to Receiving</a>
	</div>
</header>
<main class="p-6">
	<div class="max-w-2xl">
		{#if form?.error}
			<div
				class="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.error}
			</div>
		{/if}

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
					<p class="mt-0.5"><span class="badge-blue">Open</span></p>
				</div>
			</div>
		</div>

		<form method="POST" onsubmit={handleReceiveSubmit} use:enhance={receiveEnhance}>
			<input type="hidden" name="return_to" value={returnTo} />
			<div class="card mb-4">
				<div class="card-header">
					<span class="text-sm font-semibold text-gray-700">Lines</span>
				</div>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100">
							<th class="px-4 py-2 text-left text-gray-600">SKU</th>
							<th class="px-4 py-2 text-right text-gray-600">Ordered (sqft)</th>
							<th class="px-4 py-2 text-right text-gray-600">Received (sqft)</th>
						</tr>
					</thead>
					<tbody>
						{#each openLines as line (line.id)}
							<tr class="border-b border-gray-50">
								<td class="px-4 py-2 font-medium">
									<input type="hidden" name="line_id" value={line.id} />
									{line.display_label}
								</td>
								<td class="px-4 py-2 text-right font-mono text-gray-500">
									{fmtSqft(line.sqft_ordered)}
								</td>
								<td class="px-4 py-2 text-right">
									<input
										type="number"
										name="sqft_received"
										step="1"
										min="1"
										class="form-input text-sm text-right font-mono w-32"
										value={line.sqft_ordered}
										required
									/>
								</td>
							</tr>
						{/each}
						{#each doneLines as line (line.id)}
							<tr class="border-b border-gray-50 opacity-50">
								<td class="px-4 py-2 font-medium text-gray-500"
									>{line.display_label}</td
								>
								<td class="px-4 py-2 text-right font-mono text-gray-400">
									{fmtSqft(line.sqft_ordered)}
								</td>
								<td class="px-4 py-2 text-right">
									{#if line.status === 'RECEIVED'}
										<span class="font-mono text-gray-500"
											>{fmtSqft(line.sqft_received)}</span
										>
										<span class="badge-green ml-2">Received</span>
									{:else}
										<span class="badge-gray">Cancelled</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if openLines.length}
				<button
					type="button"
					class="btn-primary"
					onclick={(e) => requestReceive(e.currentTarget.form)}>Record Receipt</button
				>
			{/if}
			<dialog
				bind:this={receiveDialog}
				class="rounded-lg shadow-xl p-6 w-96 backdrop:bg-black/30"
			>
				<p class="text-sm font-medium text-gray-900 mb-1">Record receipt?</p>
				<p class="text-xs text-gray-500 mb-4">
					{openLines.length} line{openLines.length === 1 ? '' : 's'} will be received and added
					to inventory.
				</p>
				<div class="flex gap-2 justify-end">
					<button
						type="button"
						class="btn-secondary btn-sm"
						onclick={() => receiveDialog.close()}>Cancel</button
					>
					<button
						type="submit"
						class="btn-primary btn-sm"
						onclick={() => (allowReceiveSubmit = true)}>Confirm</button
					>
				</div>
			</dialog>
		</form>
	</div>
</main>
