<script>
	let { data, form } = $props();
</script>

<svelte:head><title>PandS — Sign in</title></svelte:head>

<div class="min-h-screen bg-gray-100 flex items-center justify-center">
	<div class="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-sm p-8">
		<div class="mb-7 text-center">
			<p class="text-2xl font-bold text-gray-900">PandS Inventory</p>
			<p class="text-gray-500 text-sm mt-1">Sign in to continue</p>
		</div>
		<form method="POST">
			{#if form?.error}
				<p class="text-red-600 text-sm mb-4">{form.error}</p>
			{/if}
			<div class="mb-4">
				<label class="form-label" for="user_id">Name</label>
				<select name="user_id" id="user_id" class="form-select" required>
					<option value="">— choose —</option>
					{#each data.users as user (user.id)}
						<option value={user.id}>{user.display_name}</option>
					{/each}
				</select>
			</div>
			<div class="mb-5">
				<label class="form-label" for="password">Password</label>
				<input
					type="password"
					name="password"
					id="password"
					class="form-input"
					required
					autocomplete="current-password"
				/>
			</div>
			<button type="submit" class="btn-primary w-full justify-center">Sign in</button>
		</form>
		{#if data.users.length === 0}
			<p class="mt-4 text-center text-xs text-gray-400">
				No users yet. Run the seed script or add rows to the <code>app_users</code> table.
			</p>
		{/if}
	</div>
</div>
