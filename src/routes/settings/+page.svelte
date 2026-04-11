<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
</script>

<svelte:head><title>Settings — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4">
	<h1 class="text-lg font-semibold text-gray-900">User Settings</h1>
</header>
<main class="p-6">
	<div class="max-w-md">
		<form method="POST" use:enhance>
			<div class="card mb-4">
				<div class="card-header">
					<span class="font-semibold text-sm text-gray-700">Sidebar</span>
				</div>
				<div class="card-body">
					<label for="sidebar_collapsed" class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="sidebar_collapsed"
							class="w-4 h-4 rounded border-gray-300 text-blue-600"
							checked={!!data.appUser.sidebar_collapsed}
						/>
						<span class="text-sm text-gray-700">Start with sidebar collapsed</span>
					</label>
				</div>
			</div>
			<button type="submit" class="btn-primary">Save</button>
		</form>
	</div>
</main>
