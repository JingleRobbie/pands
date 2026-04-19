<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	let showCreate = $state(false);
	let editingId = $state(null);
	let pwResetIds = $state(new Set());

	$effect(() => {
		if (form?.created) showCreate = false;
		if (form?.updated) editingId = null;
		if (form?.passwordReset) pwResetIds = new Set([...pwResetIds, form.pwId]);
	});
</script>

<svelte:head><title>Manage Users — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<div>
		<h1 class="text-lg font-semibold text-gray-900">Manage Users</h1>
		<a href="/settings" class="text-sm text-gray-400 hover:text-gray-600">← Settings</a>
	</div>
	<button class="btn-primary btn-sm" onclick={() => (showCreate = !showCreate)}>
		{showCreate ? 'Cancel' : 'Add User'}
	</button>
</header>

<main class="p-6 max-w-2xl">
	{#if showCreate}
		<div class="card mb-6">
			<div class="card-header">
				<span class="font-semibold text-sm text-gray-700">New User</span>
			</div>
			<div class="card-body">
				{#if form?.createError}
					<p class="text-red-600 text-sm mb-3">{form.createError}</p>
				{/if}
				<form method="POST" action="?/create" use:enhance class="space-y-3">
					<div>
						<label for="new-name" class="form-label">Name</label>
						<input id="new-name" name="display_name" class="form-input" required />
					</div>
					<div>
						<label for="new-role" class="form-label">Role</label>
						<select id="new-role" name="role" class="form-select">
							<option value="operator">Operator</option>
							<option value="admin">Admin</option>
						</select>
					</div>
					<div>
						<label for="new-password" class="form-label">Password</label>
						<input
							id="new-password"
							name="password"
							type="password"
							class="form-input"
							required
							autocomplete="new-password"
						/>
					</div>
					<button type="submit" class="btn-primary btn-sm">Create User</button>
				</form>
			</div>
		</div>
	{/if}

	<div class="card">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-gray-100">
					<th class="px-4 py-2 text-left text-gray-600">Name</th>
					<th class="px-4 py-2 text-left text-gray-600">Role</th>
					<th class="px-4 py-2 text-left text-gray-600">Status</th>
					<th class="px-4 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user (user.id)}
					<tr class="border-b border-gray-50 {!user.is_active ? 'opacity-50' : ''}">
						<td class="px-4 py-2 font-medium">{user.display_name}</td>
						<td class="px-4 py-2">
							<span
								class="badge {user.role === 'admin' ? 'badge-blue' : 'badge-gray'}"
							>
								{user.role}
							</span>
						</td>
						<td class="px-4 py-2">
							{#if user.is_active}
								<span class="badge-green">Active</span>
							{:else}
								<span class="badge-red">Inactive</span>
							{/if}
						</td>
						<td class="px-4 py-2 text-right">
							<button
								class="btn-secondary btn-sm"
								onclick={() => (editingId = editingId === user.id ? null : user.id)}
							>
								{editingId === user.id ? 'Cancel' : 'Edit'}
							</button>
						</td>
					</tr>

					{#if editingId === user.id}
						<tr class="bg-gray-50 border-b border-gray-100">
							<td colspan="4" class="px-4 py-4">
								{#if form?.updateError && form?.updateId === user.id}
									<p class="text-red-600 text-sm mb-3">{form.updateError}</p>
								{/if}
								<div class="flex flex-wrap gap-6">
									<!-- Edit name/role/status -->
									<form
										method="POST"
										action="?/update"
										use:enhance
										class="space-y-3 flex-1 min-w-48"
									>
										<input type="hidden" name="id" value={user.id} />
										<div>
											<label for="edit-name-{user.id}" class="form-label"
												>Name</label
											>
											<input
												id="edit-name-{user.id}"
												name="display_name"
												class="form-input"
												value={user.display_name}
												required
											/>
										</div>
										<div>
											<label for="edit-role-{user.id}" class="form-label"
												>Role</label
											>
											<select
												id="edit-role-{user.id}"
												name="role"
												class="form-select"
											>
												<option
													value="operator"
													selected={user.role === 'operator'}
													>Operator</option
												>
												<option
													value="admin"
													selected={user.role === 'admin'}>Admin</option
												>
											</select>
										</div>
										<label class="flex items-center gap-2 cursor-pointer">
											<input
												type="checkbox"
												name="is_active"
												class="rounded border-gray-300"
												checked={!!user.is_active}
												disabled={user.id === data.appUser.id}
											/>
											<span class="text-sm text-gray-700">Active</span>
										</label>
										<button type="submit" class="btn-primary btn-sm"
											>Save</button
										>
									</form>

									<!-- Reset password -->
									<form
										method="POST"
										action="?/set_password"
										use:enhance
										class="space-y-3 flex-1 min-w-48"
									>
										<input type="hidden" name="id" value={user.id} />
										{#if form?.pwError && form?.pwId === user.id}
											<p class="text-red-600 text-sm">{form.pwError}</p>
										{/if}
										{#if pwResetIds.has(user.id)}
											<p class="text-green-600 text-sm">Password updated.</p>
										{/if}
										<div>
											<label for="pw-{user.id}" class="form-label"
												>New Password</label
											>
											<input
												id="pw-{user.id}"
												name="password"
												type="password"
												class="form-input"
												autocomplete="new-password"
											/>
										</div>
										<button type="submit" class="btn-secondary btn-sm"
											>Set Password</button
										>
									</form>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</main>
