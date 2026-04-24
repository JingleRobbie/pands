<script>
	import { enhance } from '$app/forms';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const { wo, lines, contacts, customers } = data;
	let addingContact = $state(false);

	const totalSqft = lines.reduce((s, l) => s + l.sqft, 0);
</script>

<svelte:head><title>WO {wo.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<a href="/wo" class="text-gray-400 hover:text-gray-600 text-sm">← Work Orders</a>
		<h1 class="text-lg font-semibold text-gray-900">WO #{wo.so_number}</h1>
	</div>
	<div class="flex items-center gap-2">
		{#if wo.status !== 'COMPLETE' && wo.status !== 'CANCELLED'}
			<a href="/wo/{wo.id}/schedule" class="btn-primary btn-sm">Schedule Production</a>
		{/if}
		<a href="/wo/{wo.id}/confirm" class="btn-secondary btn-sm">View Runs</a>
		{#if wo.customer_id}
			<a href="/shipments/new?wo={wo.id}" class="btn-secondary btn-sm">New Shipment</a>
		{/if}
	</div>
</header>

<main class="p-6 max-w-4xl space-y-4">
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Details</span>
		</div>
		<div class="card-body grid grid-cols-3 gap-4 text-sm">
			<div>
				<p class="form-label">Customer</p>
				{#if wo.customer_id}
					<a href="/customers/{wo.customer_id}" class="text-blue-600 hover:underline"
						>{wo.customer_display_name}</a
					>
				{:else}
					<form
						method="POST"
						action="?/linkCustomer"
						use:enhance
						class="flex gap-2 items-center mt-1"
					>
						<select name="customer_id" class="form-select text-sm py-1">
							<option value="">— link customer —</option>
							{#each customers as c (c.id)}
								<option value={c.id}>{c.name}</option>
							{/each}
						</select>
						<button type="submit" class="btn-primary btn-sm">Link</button>
						<a href="/customers/new" class="btn-secondary btn-sm">New</a>
					</form>
					{#if form?.linkError}
						<p class="text-red-600 text-xs mt-1">{form.linkError}</p>
					{/if}
				{/if}
			</div>
			<div>
				<p class="form-label">Job</p>
				<p class="text-gray-900">{wo.job_name}</p>
			</div>
			<div>
				<p class="form-label">Branch</p>
				<p class="text-gray-900">{wo.branch}</p>
			</div>
			<div>
				<p class="form-label">Ship Date</p>
				<p class="text-gray-900">{fmtDate(wo.ship_date)}</p>
			</div>
			<div>
				<p class="form-label">Total Sq Ft</p>
				<p class="text-gray-900 font-mono">{fmtSqft(totalSqft)}</p>
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700"
				>{lines.length} line{lines.length === 1 ? '' : 's'}</span
			>
		</div>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-gray-100 bg-gray-50">
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Roll For</th>
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Facing</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Qty</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Thickness</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Width</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Length</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Sq Ft</th>
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Instructions</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">
						<span class="relative inline-flex items-center gap-1 group cursor-default">
							Progress
							<span class="text-gray-400 text-xs">ⓘ</span>
							<span
								class="pointer-events-none absolute right-0 top-5 z-20 hidden group-hover:block w-52 rounded bg-gray-800 p-2.5 text-left text-xs text-white shadow-lg leading-relaxed font-normal"
							>
								<span class="text-green-400 font-bold">N</span> / total — produced /
								total<br />
								<span class="text-blue-400 font-bold">+N</span> — scheduled
							</span>
						</span>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each lines as line (line.id)}
					<tr class="border-b border-gray-100">
						<td class="px-4 py-2 text-gray-500">{line.rollfor}</td>
						<td class="px-4 py-2 text-gray-500">{line.facing}</td>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums">{line.qty}</td>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{line.thickness_in}"</td
						>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{line.width_in}"</td
						>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{line.length_ft}'</td
						>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{fmtSqft(line.sqft)}</td
						>
						<td class="px-4 py-2 text-gray-400 italic text-xs">{line.instructions}</td>
						<td class="px-4 py-2 text-right tabular-nums">
							<span class="text-green-600 font-medium">{line.rolls_produced}</span
							><span class="text-gray-400"> / {line.qty} rolls</span>
							{#if line.rolls_scheduled > 0}
								<div class="text-xs text-blue-500">
									+{line.rolls_scheduled} scheduled
								</div>
							{/if}
						</td>
					</tr>
				{/each}
				<tr class="border-t border-gray-200 bg-gray-50">
					<td colspan="6" class="px-4 py-2 text-sm text-gray-500 font-medium">Total</td>
					<td class="px-4 py-2 text-right font-mono font-medium text-gray-700"
						>{fmtSqft(totalSqft)}</td
					>
					<td colspan="2"></td>
				</tr>
			</tbody>
		</table>
	</div>

	<!-- Contacts -->
	<div class="card">
		<div class="card-header flex items-center justify-between">
			<span class="font-semibold text-sm text-gray-700">Contacts</span>
			{#if !addingContact}
				<button onclick={() => (addingContact = true)} class="btn-secondary btn-sm"
					>+ Add</button
				>
			{/if}
		</div>

		{#if addingContact}
			<form
				method="POST"
				action="?/addContact"
				use:enhance={{
					onResult: () => {
						addingContact = false;
					},
				}}
				class="card-body border-b border-gray-100 grid grid-cols-2 gap-3 text-sm"
			>
				{#if form?.contactError}
					<p class="col-span-2 text-red-600 text-xs">{form.contactError}</p>
				{/if}
				<div>
					<label for="c-name" class="form-label">Name *</label>
					<input id="c-name" name="name" class="form-input" required />
				</div>
				<div>
					<label for="c-role" class="form-label">Role</label>
					<input
						id="c-role"
						name="role"
						class="form-input"
						placeholder="e.g. Site Foreman"
					/>
				</div>
				<div>
					<label for="c-phone" class="form-label">Phone</label>
					<input id="c-phone" name="phone" class="form-input" />
				</div>
				<div>
					<label for="c-email" class="form-label">Email</label>
					<input id="c-email" name="email" type="email" class="form-input" />
				</div>
				<div class="col-span-2 flex gap-2">
					<button type="submit" class="btn-primary btn-sm">Save Contact</button>
					<button
						type="button"
						onclick={() => (addingContact = false)}
						class="btn-secondary btn-sm">Cancel</button
					>
				</div>
			</form>
		{/if}

		{#if contacts.length === 0 && !addingContact}
			<div class="card-body text-sm text-gray-400">No contacts yet.</div>
		{:else if contacts.length > 0}
			<table class="w-full text-sm">
				<tbody>
					{#each contacts as contact (contact.id)}
						<tr class="border-b border-gray-100 last:border-0">
							<td class="px-4 py-3">
								<p class="font-medium text-gray-800">{contact.name}</p>
								{#if contact.role}<p class="text-xs text-gray-400">
										{contact.role}
									</p>{/if}
							</td>
							<td class="px-4 py-3 text-gray-600">{contact.phone ?? '—'}</td>
							<td class="px-4 py-3 text-gray-600">{contact.email ?? '—'}</td>
							<td class="px-4 py-3 text-right">
								<form method="POST" action="?/deleteContact" use:enhance>
									<input type="hidden" name="id" value={contact.id} />
									<button
										type="submit"
										class="text-red-400 hover:text-red-600 text-xs"
										>Remove</button
									>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</main>
