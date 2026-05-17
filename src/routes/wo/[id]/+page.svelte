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
	const productionGroupsByParent = $derived(data.productionGroupsByParent ?? {});
	const unbranchedLines = $derived(data.unbranchedLines);
	const canComplete = $derived(data.canComplete);
	const contacts = $derived(data.contacts);
	const customers = $derived(data.customers);
	const justCreatedShipmentId = $derived(data.justCreatedShipmentId);
	const justCreatedCustomer = $derived(data.justCreatedCustomer);
	const returnTo = $derived(getReturnTo(page.url, '/wo'));
	let addingContact = $state(false);
	let dismissed = $state(false);
	let pendingBranchDelete = $state(null);
	let deleteBranchDialog = $state(null);
	let pendingInstructionsLine = $state(null);
	let instructionsDialog = $state(null);

	const totalSqft = $derived(lines.reduce((s, l) => s + l.sqft, 0));
	const hasBranched = $derived(productionLines.length > 0);
	const hasStale = $derived(
		billingLines.some((l) => l.reconciliation_status === 'STALE') ||
			unbranchedLines.some((l) => l.reconciliation_status === 'STALE')
	);

	function requestBranchDelete(line) {
		pendingBranchDelete = line;
		deleteBranchDialog.showModal();
	}

	function childWidthLabel(child) {
		return child.width_display ?? child.width_in;
	}

	function requestInstructionEdit(line) {
		pendingInstructionsLine = line;
		instructionsDialog.showModal();
	}
</script>

<svelte:head><title>WO {wo.so_number} — PandS</title></svelte:head>

<header class="page-header px-6 py-4 flex items-center justify-between">
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
			<a href="/wo/{wo.id}/labels" class="btn-secondary btn-sm">Labels</a>
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

<main class="p-6 max-w-6xl space-y-4">
	<div class="card">
		<div class="card-header">
			<span class="font-semibold text-sm text-gray-700">Details</span>
			<span class="text-sm text-gray-600 font-medium">{wo.branch}</span>
			{#if wo.ship_asap}<span class="badge-red font-semibold tracking-wide">Requested ASAP</span>{:else}<span></span>{/if}
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
				<p class="form-label">Ship Date</p>
				<form method="POST" action="?/updateShipDate" use:enhance class="mt-1 space-y-1.5">
					<div class="flex items-center gap-2">
						<input
							name="ship_date"
							type="date"
							class="form-input w-40 text-sm py-1"
							value={wo.ship_date ? (typeof wo.ship_date === 'string' ? wo.ship_date : wo.ship_date.toISOString()).slice(0, 10) : ''}
						/>
						<button type="submit" class="btn-secondary btn-sm">Save</button>
					</div>
					{#if form?.shipDateError}
						<p class="text-red-600 text-xs">{form.shipDateError}</p>
					{/if}
				</form>
			</div>
			<div>
				<p class="form-label">Customer PO</p>
				<form method="POST" action="?/updateCustomerPo" use:enhance class="mt-1">
					<div class="flex items-center gap-2">
						<input name="customer_po" type="text" class="form-input text-sm py-1" value={wo.customer_po ?? ''} placeholder="—" />
						<button type="submit" class="btn-secondary btn-sm">Save</button>
					</div>
				</form>
			</div>
			<div>
				<p class="form-label">Total Sq Ft</p>
				<p class="text-gray-900 font-mono">{fmtSqft(totalSqft)}</p>
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header flex items-center justify-between">
			<span class="font-semibold text-sm text-gray-700">
				Lines
				{#if hasStale}<span class="ml-1 text-amber-500">●</span>{/if}
			</span>
			<span class="text-xs text-gray-400"
				>{lines.length} line{lines.length === 1 ? '' : 's'} total</span
			>
		</div>

		{#if form?.branchError}
			<div
				class="mx-4 mt-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200"
			>
				{form.branchError}
			</div>
		{/if}
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-gray-100 bg-gray-50">
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Facing</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Qty</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Th</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium min-w-28">Width</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Length</th>
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Roll For</th>
					<th class="px-4 py-2 text-left text-gray-500 font-medium">Instructions</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Sq Ft</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Path / Status</th>
					<th class="px-4 py-2 text-right text-gray-500 font-medium">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each [...billingLines, ...unbranchedLines] as line (line.id)}
					{@const rawChildren = productionLines.filter(
						(p) => p.parent_line_id === line.id
					)}
					{@const children = productionGroupsByParent[line.id] ?? rawChildren}
					{@const canEdit =
						data.user?.role === 'admin' &&
						wo.status !== 'COMPLETE' &&
						wo.status !== 'CANCELLED'}
					<tr
						class="align-top border-b border-gray-100 {line.reconciliation_status ===
						'STALE'
							? 'bg-amber-50'
							: ''}"
					>
						<td class="px-4 py-2 text-gray-500">{line.facing}</td>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums">{line.qty}</td>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{line.thickness_in}"</td
						>
						<td class="px-4 py-2 text-right font-mono">
							{#if line.line_type === 'BILLING' && children.length > 0}
								<div class="flex flex-col items-end gap-0.5">
									{#if line.reconciliation_status === 'STALE'}
										<span class="badge-amber text-xs mb-1">Needs Review</span>
									{:else if line.reconciliation_status === 'RECONCILED'}
										<span class="badge-green text-xs mb-1">Reconciled</span>
									{/if}
									<span class="text-gray-600">{line.width_in}"</span>
									{#each children as child (child.group_key ?? child.id)}
										<span class="text-gray-600"
											>→ {childWidthLabel(child)}"</span
										>
									{/each}
								</div>
							{:else}
								<div class="flex flex-col items-end gap-0.5">
									{#if line.reconciliation_status === 'STALE'}
										<span class="badge-amber text-xs mb-1">Needs Review</span>
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
						<td class="px-4 py-2 text-gray-500">{line.rollfor || '—'}</td>
						<td class="px-4 py-2 text-gray-500">
							{#if line.display_instructions}
								<button
									type="button"
									class="text-left hover:text-blue-700 hover:underline {line.display_instructions !==
									(line.instructions ?? '').trim()
										? 'text-blue-700'
										: ''}"
									onclick={() => requestInstructionEdit(line)}
									disabled={!canEdit}>{line.display_instructions}</button
								>
							{:else}
								<button
									type="button"
									class="text-gray-300 hover:text-blue-700 hover:underline"
									onclick={() => requestInstructionEdit(line)}
									disabled={!canEdit}>—</button
								>
							{/if}
						</td>
						<td class="px-4 py-2 text-right text-gray-600 tabular-nums font-mono"
							>{fmtSqft(line.sqft)}</td
						>
						<td class="px-4 py-2 text-right text-xs">
							<div class="flex flex-col items-end gap-1">
								<span class="{line.progress.path.class} text-xs"
									>{line.progress.path.label}</span
								>
								<span class="{line.progress.status.class} text-xs"
									>{line.progress.status.label}</span
								>
							</div>
						</td>
						<td class="px-4 py-2 text-right">
							{#if line.line_type === 'UNBRANCHED' && wo.status !== 'COMPLETE'}
								<a
									href="/wo/{wo.id}/branch?lineId={line.id}"
									class="text-blue-600 hover:underline text-xs">Set Cut-Down</a
								>
							{/if}
							{#if line.line_type === 'BILLING' && children.length > 0 && wo.status !== 'COMPLETE' && wo.status !== 'CANCELLED'}
								<a
									href="/wo/{wo.id}/branch?lineId={line.id}"
									class="text-blue-600 hover:underline text-xs">Edit Cut-Down</a
								>
								<button
									type="button"
									class="text-red-600 hover:underline text-xs ml-2"
									onclick={() => requestBranchDelete(line)}
									>Remove Cut-Down Setup</button
								>
							{/if}
							{#if line.reconciliation_status === 'STALE'}
								<a
									href="/wo/{wo.id}/diff"
									class="text-amber-600 hover:underline text-xs ml-2">Reconcile</a
								>
							{/if}
						</td>
					</tr>
				{/each}
				<tr class="border-t border-gray-200 bg-gray-50">
					<td colspan="7" class="px-4 py-2 text-sm text-gray-500 font-medium">Total</td>
					<td class="px-4 py-2 text-right font-mono font-medium text-gray-700"
						>{fmtSqft(totalSqft)}</td
					>
					<td colspan="2"></td>
				</tr>
			</tbody>
		</table>
	</div>

	<dialog bind:this={deleteBranchDialog} class="modal-dialog modal-dialog-sm">
		<p class="text-sm font-medium text-gray-900 mb-1">Remove cut-down setup?</p>
		{#if pendingBranchDelete}
			<p class="text-sm text-gray-600 mb-3">
				This will remove the production child rows for
				<span class="font-medium">{pendingBranchDelete.facing}</span>
				{pendingBranchDelete.thickness_in}" × {pendingBranchDelete.width_in}" ×
				{pendingBranchDelete.length_ft}'.
			</p>
			<p class="text-xs text-gray-500 mb-4">
				The original billing/source line will remain and can be set up again. Setups with
				downstream cut-downs, production runs, WIP, or shipments cannot be removed.
			</p>
			<form
				method="POST"
				action="?/deleteBranch"
				use:enhance={() => {
					return async ({ update }) => {
						deleteBranchDialog.close();
						pendingBranchDelete = null;
						await update();
					};
				}}
				class="flex justify-end gap-2"
			>
				<input type="hidden" name="line_id" value={pendingBranchDelete.id} />
				<button
					type="button"
					class="btn-secondary btn-sm"
					onclick={() => {
						deleteBranchDialog.close();
						pendingBranchDelete = null;
					}}>Cancel</button
				>
				<button type="submit" class="btn-danger btn-sm">Remove Setup</button>
			</form>
		{/if}
	</dialog>

	<dialog bind:this={instructionsDialog} class="modal-dialog modal-dialog-md">
		{#if pendingInstructionsLine}
			<div class="space-y-4">
				<div>
					<p class="text-sm font-medium text-gray-900 mb-1">Edit field instructions</p>
					<p class="text-xs text-gray-500">
						Original import instructions are read-only. Field instructions override the
						line list when they differ.
					</p>
				</div>
				<div>
					<p class="form-label">Imported Instructions</p>
					<div
						class="min-h-16 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap"
					>
						{pendingInstructionsLine.instructions || '—'}
					</div>
				</div>
				<form
					method="POST"
					action="?/updateFieldInstructions"
					use:enhance={() => {
						return async ({ update }) => {
							instructionsDialog.close();
							pendingInstructionsLine = null;
							await update();
						};
					}}
					class="space-y-3"
				>
					<input type="hidden" name="line_id" value={pendingInstructionsLine.id} />
					<div>
						<label for="field-instructions" class="form-label">Field Instructions</label
						>
						<textarea
							id="field-instructions"
							name="field_instructions"
							class="form-input"
							rows="4">{pendingInstructionsLine.field_instructions ?? ''}</textarea
						>
					</div>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="btn-secondary btn-sm"
							onclick={() => {
								instructionsDialog.close();
								pendingInstructionsLine = null;
							}}>Cancel</button
						>
						<button type="submit" class="btn-primary btn-sm">Save</button>
					</div>
				</form>
			</div>
		{/if}
	</dialog>

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
