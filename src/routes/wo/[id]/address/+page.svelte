<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const { wo, savedAddresses } = data;

	// Current field values — initialized from WO's saved address
	let ship_to_name = $state(wo.ship_to_name ?? '');
	let ship_addr1 = $state(wo.ship_addr1 ?? '');
	let ship_addr2 = $state(wo.ship_addr2 ?? '');
	let ship_city = $state(wo.ship_city ?? '');
	let ship_state = $state(wo.ship_state ?? '');
	let ship_zip = $state(wo.ship_zip ?? '');

	let selectedAddressId = $state('');
	let saveToBook = $state(false);

	// TODO(human): When selectedAddressId changes, find the matching address in
	// savedAddresses and update all field state variables above.
	// savedAddresses is an array of objects with: id, nickname, ship_to_name,
	// addr1, addr2, city, state, zip
	// selectedAddressId is a string (the id from the <select>).
	// Hint: use $effect(() => { ... }) — it re-runs whenever selectedAddressId changes.
	// If selectedAddressId is empty string, do nothing.
	$effect(() => {
		if (!selectedAddressId) return;
		const addr = savedAddresses.find((a) => String(a.id) === selectedAddressId);
		if (!addr) return;
		ship_to_name = addr.ship_to_name;
		ship_addr1 = addr.addr1;
		ship_addr2 = addr.addr2;
		ship_city = addr.city;
		ship_state = addr.state;
		ship_zip = addr.zip;
	});
</script>

<div class="p-6 max-w-2xl">
	<div class="flex items-center gap-4 mb-6">
		<a href="/wo/{wo.id}" class="text-gray-400 hover:text-gray-600 text-sm"
			>← WO #{wo.so_number}</a
		>
		<h1 class="text-xl font-semibold text-gray-900">Shipping Address</h1>
	</div>

	<form method="POST" use:enhance class="space-y-6">
		{#if form?.error}
			<p class="text-red-600 text-sm">{form.error}</p>
		{/if}

		{#if savedAddresses.length > 0}
			<div class="card card-body">
				<label for="addr-picker" class="form-label">Pick a saved address</label>
				<select id="addr-picker" class="form-select" bind:value={selectedAddressId}>
					<option value="">— choose saved address —</option>
					{#each savedAddresses as a (a.id)}
						<option value={String(a.id)}>{a.nickname}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="card card-body space-y-4">
			<div>
				<label for="ship_to_name" class="form-label">Ship To Name</label>
				<input
					id="ship_to_name"
					name="ship_to_name"
					class="form-input"
					bind:value={ship_to_name}
				/>
			</div>
			<div>
				<label for="ship_addr1" class="form-label">Address Line 1</label>
				<input
					id="ship_addr1"
					name="ship_addr1"
					class="form-input"
					bind:value={ship_addr1}
				/>
			</div>
			<div>
				<label for="ship_addr2" class="form-label">Address Line 2</label>
				<input
					id="ship_addr2"
					name="ship_addr2"
					class="form-input"
					bind:value={ship_addr2}
				/>
			</div>
			<div class="grid grid-cols-3 gap-4">
				<div class="col-span-1">
					<label for="ship_city" class="form-label">City</label>
					<input
						id="ship_city"
						name="ship_city"
						class="form-input"
						bind:value={ship_city}
					/>
				</div>
				<div>
					<label for="ship_state" class="form-label">State</label>
					<input
						id="ship_state"
						name="ship_state"
						class="form-input"
						bind:value={ship_state}
					/>
				</div>
				<div>
					<label for="ship_zip" class="form-label">Zip</label>
					<input id="ship_zip" name="ship_zip" class="form-input" bind:value={ship_zip} />
				</div>
			</div>
		</div>

		{#if wo.customer_id}
			<div class="card card-body space-y-3">
				<label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
					<input type="checkbox" name="save_to_book" bind:checked={saveToBook} />
					Save this address to {wo.customer_name}'s address book
				</label>
				{#if saveToBook}
					<div>
						<label for="nickname" class="form-label">Nickname *</label>
						<input
							id="nickname"
							name="nickname"
							class="form-input"
							placeholder="e.g. Main Warehouse"
							required={saveToBook}
						/>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Save Address</button>
			<a href="/wo/{wo.id}" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
