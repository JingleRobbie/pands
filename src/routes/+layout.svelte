<script>
	import '../app.css';
	import { page } from '$app/stores';
	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="stylesheet" href="/css/app.css" />
</svelte:head>

<div class="bg-gray-100 min-h-screen flex">
	<!-- Sidebar -->
	<aside class="w-56 min-h-screen flex-shrink-0 flex flex-col" style="background-color:#1e2433;">
		<div class="px-5 py-5 border-b border-white/10">
			<span class="text-white font-bold text-lg tracking-tight">PandS</span>
			<span class="text-white/40 text-xs ml-1">Inventory</span>
		</div>

		<nav class="flex-1 py-4 space-y-0.5 px-2">
			{#each [{ href: '/matrix', label: 'Overview', icon: 'grid' }, { href: '/po', label: 'Purchase Orders', icon: 'box' }, { href: '/so', label: 'Sales Orders', icon: 'doc' }, { href: '/production', label: 'Production', icon: 'check' }, { href: '/calendar', label: 'Calendar', icon: 'cal' }] as nav}
				<a
					href={nav.href}
					class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors
				          {$page.url.pathname.startsWith(nav.href)
						? 'bg-blue-600 text-white'
						: 'text-white/70 hover:bg-white/10 hover:text-white'}"
				>
					{#if nav.icon === 'grid'}
						<svg
							class="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 10h18M3 14h18M10 3v18M14 3v18"
							/></svg
						>
					{:else if nav.icon === 'box'}
						<svg
							class="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
							/></svg
						>
					{:else if nav.icon === 'doc'}
						<svg
							class="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/></svg
						>
					{:else if nav.icon === 'check'}
						<svg
							class="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
							/></svg
						>
					{:else}
						<svg
							class="w-4 h-4 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line
								x1="16"
								y1="2"
								x2="16"
								y2="6"
							/><line x1="8" y1="2" x2="8" y2="6" /><line
								x1="3"
								y1="10"
								x2="21"
								y2="10"
							/></svg
						>
					{/if}
					{nav.label}
				</a>
			{/each}
		</nav>

		<div class="px-4 py-4 border-t border-white/10">
			{#if data.appUser}
				<div class="flex items-center justify-between">
					<span class="text-white/60 text-xs">{data.appUser.display_name}</span>
					<a href="/logout" class="text-white/40 hover:text-white/70 text-xs">switch</a>
				</div>
			{/if}
		</div>
	</aside>

	<!-- Main content -->
	<div class="flex-1 flex flex-col min-h-screen overflow-hidden">
		{@render children()}
	</div>
</div>
