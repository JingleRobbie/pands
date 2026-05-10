<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getReturnTo, withReturnTo } from '$lib/navigation.js';
	import { fmtDate, fmtSqft } from '$lib/utils.js';
	let { data, form } = $props();
	const wo = $derived(data.wo);
	const lines = $derived(data.lines);
	const billingLines = $derived(data.billingLines);
	const productionLines = $derived(data.productionLines);
	const unbranchedLines = $derived(data.unbranchedLines);
	const canComplete = $derived(data.canComplete);
	const contacts = $derived(data.contacts);
	const customers = $derived(data.customers);
	const justCreatedShipmentId = $derived(data.justCreatedShipmentId);
	const justCreatedCustomer = $derived(data.justCreatedCustomer);
	const returnTo = $derived(getReturnTo(page.url, '/wo'));
	let addingContact = $state(false);
	let dismissed = $state(false);
	let activeTab = $state('billing');

	const totalSqft = $derived(lines.reduce((s, l) => s + l.sqft, 0));
	const hasBranched = $derived(productionLines.length > 0);
	const hasStale = $derived(
		billingLines.some((l) => l.reconciliation_status === 'STALE') ||
			unbranchedLines.some((l) => l.reconciliation_status === 'STALE')
	);
</script>

<svelte:head><title>WO {wo.so_number} — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div class="flex items-center gap-4">
		<a href={returnTo} class="text-gray-400 hover:text-gray-600 text-sm">← Work Orders</a>
		<h1 class="text-lg font-semibold text-gray-900">
			WO #{wo.so_number}{#if wo.customer_id}
				— {wo.customer_display_name}{:else if wo.customer_name}
				— <span class="text-amber-600 font-normal text-base italic">{wo.customer_name}</span
				>
				<span class="text-amber-500 text-sm font-normal"> (not linked)</span>
			{/if}
		</h1>
	</div>
	<div class="flex items-center gap-2">
		{#if hasBranched}
			<a href="/wo/{wo.id}/cutdown" class="btn-secondary btn-sm">Cut-Downs</a>
		{/if}
		<a href="/wo/{wo.id}/diff" class="btn-secondary btn-sm">Diff</a>
		{#if wo.status !== 'COMPLETE' && wo.status !== 'CANCELLED'}
			<a href={withReturnTo(`/wo/${wo.id}/schedule`, returnTo)} class="btn-primary btn-sm"
				>Schedule Production</a
			>
		{/if}
		<a href={withReturnTo(`/wo/${wo.id}/confirm`, returnTo)} class="btn-secondary btn-sm"
			>View Runs</a
		>
		{#if wo.customer_id}
			<a href="/shipments/new?wo={wo.id}" class="btn-secondary btn-sm">New Shipment</a>
		{/if}
		{#if canComplete}
			<form method="POST" action="?/completeWo" use:enhance>
				<button type="submit" class="btn-primary btn-sm">Mark Complete</button>
			</form>
		{/if}
	</div>
</header>

{#if hasStale && !dismissed}
	<div
		class="mx-6 mt-4 px-4 py-3 rounded-md text-sm bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-between"
	>
		<span
			>Billing lines need reconciliation before this WO can be completed. <a
				href="/wo/{wo.id}/diff"
				class="underline font-medium">Review diff →</a
			></span
		>
		<button
			type="button"
			class="text-amber-700 hover:text-amber-900 leading-none"
			onclick={() => (dismissed = true)}>×</button
		>
	</div>
{/if}
{#if form?.completeError}
	<div
		class="mx-6 mt-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
	>
		{form.completeError}
	</div>
{/if}

{#if justCreatedShipmentId && !dismissed}
	<div
		class="mx-6 mt-4 px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200 flex items-center justify-between"
	>
		<span
			>Shipment created. <a
				href="/shipments/{justCreatedShipmentId}"
				class="underline font-medium">View packing slip →</a
			></span
		>
		<button
			type="button"
			class="text-green-700 hover:text-green-900 leading-none"
			onclick={() => (dismissed = true)}>×</button
		>
	</div>
{/if}
{#if justCreatedCustomer && !dismissed}
	<div
		class="mx-6 mt-4 px-4 py-3 rounded-md text-sm bg-green-50 text-green-800 border border-green-200 flex items-center justify-between"
	>
		<span>Customer saved and linked to this work order.</span>
		<button
			type="button"
			class="text-green-700 hover:text-green-900 leading-none"
			onclick={() => (dismissed = true)}>×</button
		>
	</div>
{/if}

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
						<a href="/customers/new?wo={wo.id}" class="btn-secondary btn-sm">New</a>
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
		<!-- Tab bar -->
		<div class="card-header flex items-center justify-between">
			<div class="flex gap-1">
				<button
					type="button"
					class="px-3 py-1 text-sm rounded {activeTab === 'billing'
						? 'bg-gray-200 font-medium text-gray-800'
						: 'text-gray-500 hover:text-gray-700'}"
					onclick={() => (activeTab = 'billing')}
				>
					Billing
					{#if hasStale}<span class="ml-1 text-amber-500">●</span>{/if}
				</button>
				{#if hasBranched}
					<button
						type="button"
						class="px-3 py-1 text-sm rounded {activeTab === 'production'
							? 'bg-gray-200 font-medium text-gray-800'
							: 'text-gray-500 hover:text-gray-700'}"
						onclick={() => (activeTab = 'production')}
					>
						Production ({productionLines.length})
					</button>
				{/if}
			</div>
			<span class="text-xs text-gray-400"
				>{lines.length} line{lines.length === 1 ? '' : 's'} total</span
			>
		</div>

		{#if activeTab === 'billing'}
			<!-- Billing + unbranched lines -->
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-100 bg-gray-50">
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Roll For</th>
						<th class="px-4 py-2 text-left text-gray-500 font-medium">Facing</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Qty</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Width</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Length</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Sq Ft</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Progress</th>
						<th class="px-4 py-2 text-right text-gray-500 font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each [...billingLines, ...unbranchedLines] as line (line.id)}
						{@const children = productionLines.filter(
							(p) => p.parent_line_id === line.id
						)}
						<tr
							class="align-top border-b border-gray-100 {line.reconciliation_status ===
							'STALE'
								? 'bg-amber-50'
								: ''}"
						>
							<td class="px-4 py-2 text-gray-500">{line.rollfor}</td>
							<td class="px-4 py-2 text-gray-500">{line.facing}</td>
							<td class="px-4 py-2 text-right text-gray-600 tabular-nums"
								>{line.qty}</td
							>
							<td class="px-4 py-2 text-right font-mono">
								{#if line.line_type === 'BILLING' && children.length > 0}
									<div class="flex flex-col items-end gap-0.5">
										{#if line.reconciliation_status === 'STALE'}
											<span class="badge-amber text-xs mb-1">Stale</span>
										{:else if line.reconciliation_status === 'RECONCILED'}
											<span class="badge-green text-xs mb-1">Reconciled</span>
										{/if}
										<span class="text-gray-600"
											>{line.width_in}" → {children[0].width_in}"</span
										>
										{#each children.slice(1) as child (child.id)}
											<span class="text-gray-600">→ {child.width_in}"</span>
										{/each}
									</div>
								{:else}
									<div class="flex flex-col items-end gap-0.5">
										{#if line.reconciliation_status === 'STALE'}
											<span class="badge-amber text-xs mb-1">Stale</span>
										{:else if line.reconciliation_status === 'RECONCILED'}
											<span class="badge-green text-xs mb-1">Reconciled</span>
										{/if}
										<span class="text-gray-600">{line.width_in}"</span>
									</div>
								{/if}
							</td>
							<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
								>{line.length_ft}'</td
							>
							<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
								>{fmtSqft(line.sqft)}</td
							>
							<td class="px-4 py-2 text-right tabular-nums text-xs">
								<span class="text-green-600 font-medium">{line.rolls_produced}</span
								><span class="text-gray-400"> / {line.qty}</span>
							</td>
							<td class="px-4 py-2 text-right">
								{#if line.line_type === 'UNBRANCHED' && wo.status !== 'COMPLETE'}
									<a
										href="/wo/{wo.id}/branch?lineId={line.id}"
										class="text-blue-600 hover:underline text-xs">Branch</a
									>
								{/if}
								{#if line.reconciliation_status === 'STALE'}
									<a
										href="/wo/{wo.id}/diff"
										class="text-amber-600 hover:underline text-xs ml-2"
										>Reconcile</a
									>
								{/if}
							</td>
						</tr>
					{/each}
					<tr class="border-t border-gray-200 bg-gray-50">
						<td colspan="5" class="px-4 py-2 text-sm text-gray-500 font-medium"
							>Total</td
						>
						<td class="px-4 py-2 text-right font-mono font-medium text-gray-700"
							>{fmtSqft(totalSqft)}</td
						>
						<td colspan="2"></td>
					</tr>
				</tbody>
			</table>
		{:else}
			<!-- Production lines grouped by billing parent -->

			<table class="w-full text-sm">
				<tbody>
					{#each billingLines as billing (billing.id)}
						{@const children = productionLines.filter(
							(p) => p.parent_line_id === billing.id
						)}
						{#if children.length > 0}
							<tr>
								<td
									colspan="8"
									class="px-4 py-2 text-sm text-gray-500 font-medium bg-gray-50"
								>
									<div
										class="border-b border-gray-100 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium"
									>
										{billing.thickness_in}" × {billing.width_in}" × {billing.length_ft}'
										— {fmtSqft(billing.sqft)} sqft
									</div>
								</td>
							</tr>
							{#each children as line (line.id)}
								<tr class="border-b border-gray-100">
									<td class="px-4 py-2 text-gray-500">{line.rollfor}</td>
									<td class="px-4 py-2 text-gray-500">{line.facing}</td>
									<td class="px-4 py-2 text-right text-gray-600 tabular-nums"
										>{line.qty}</td
									>
									<td
										class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
										>{line.width_in}"</td
									>
									<td
										class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
										>{line.length_ft}'</td
									>
									<td
										class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
										>{fmtSqft(line.sqft)}</td
									>
									<td class="px-4 py-2 text-right tabular-nums text-xs">
										<span class="text-green-600 font-medium"
											>{line.rolls_produced}</span
										><span class="text-gray-400"> / {line.qty}</span>
										{#if line.rolls_scheduled > 0}
											<div class="text-blue-500">
												+{line.rolls_scheduled} sched
											</div>
										{/if}
									</td>
									{#if line.path_type}
										<td class="px-4 py-2"
											><span class="badge-gray text-xs">{line.path_type}</span
											></td
										>
									{:else}
										<td class="px-4 py-2 text-gray-400 text-xs">—</td>
									{/if}
								</tr>
							{/each}
						{/if}
					{/each}
				</tbody>
			</table>
		{/if}
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
