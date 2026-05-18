<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
</script>

<svelte:head><title>Settings - PandS</title></svelte:head>

<header class="page-header px-6 py-4">
	<h1 class="text-lg font-semibold text-gray-900">User Settings</h1>
</header>
<main class="p-6">
	<div class="max-w-md">
		<form method="POST" use:enhance>
			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700 dark:text-gray-300">Appearance</span>
				</div>
				<div class="card-body space-y-3">
					<label for="sidebar_collapsed" class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							id="sidebar_collapsed"
							name="sidebar_collapsed"
							class="w-4 h-4 rounded border-gray-300 text-blue-600"
							checked={!!data.appUser.sidebar_collapsed}
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">Start with sidebar collapsed</span>
					</label>
					<label for="dark_mode" class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							id="dark_mode"
							name="dark_mode"
							class="w-4 h-4 rounded border-gray-300 text-blue-600"
							checked={!!data.appUser.dark_mode}
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">Dark mode</span>
					</label>
				</div>
			</div>
			<button type="submit" class="btn-primary">Save</button>
		</form>
		{#if data.appUser?.role === 'admin'}
			<div class="card mt-4">
				<div class="card-body flex items-center justify-between">
					<span class="text-sm text-gray-700">User accounts and passwords</span>
					<a href="/settings/users" class="btn-secondary btn-sm">Manage Users →</a>
				</div>
			</div>
		{/if}
	</div>
</main>
