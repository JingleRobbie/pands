<script>
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fmtDate } from '$lib/utils.js';

	let { open = $bindable(false) } = $props();

	let query = $state('');
	let wos = $state([]); // list of matching WOs
	let detail = $state(null); // { wo, activeRuns, allRuns, shipments } for selected WO
	let loading = $state(false);
	let expanded = $state(false);
	let inputEl = $state(null);
	let debounceTimer;

	function handleInput() {
		clearTimeout(debounceTimer);
		detail = null;
		expanded = false;
		if (query.trim().length < 3) {
			wos = [];
			loading = false;
			return;
		}
		loading = true;
		debounceTimer = setTimeout(async () => {
			const res = await fetch(`/search?q=${encodeURIComponent(query.trim())}`);
			wos = await res.json();
			loading = false;
		}, 200);
	}

	async function selectWo(wo) {
		detail = null;
		loading = true;
		const res = await fetch(`/search?wo_id=${wo.id}`);
		detail = await res.json();
		loading = false;
	}

	function back() {
		detail = null;
		expanded = false;
	}

	function close() {
		open = false;
		query = '';
		wos = [];
		detail = null;
		loading = false;
		expanded = false;
		clearTimeout(debounceTimer);
	}

	function navigate(href) {
		close();
		goto(href);
	}

	function closeFromBackdropKey(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			close();
		}
	}

	$effect(() => {
		if (open) inputEl?.focus();
	});

	// Close on navigation — untrack(open) so this effect only re-runs on URL changes
	$effect(() => {
		$page.url.pathname;
		untrack(() => {
			if (open) close();
		});
	});

	function statusBadge(s) {
		if (s === 'SCHEDULED') return 'badge-blue';
		if (s === 'COMPLETED') return 'badge-green';
		if (s === 'SHIPPED') return 'badge-green';
		if (s === 'DRAFT') return 'badge-amber';
		return 'badge-gray';
	}

	function woBadge(s) {
		if (s === 'COMPLETE') return 'badge-green';
		if (s === 'CANCELLED') return 'badge-red';
		return 'badge-amber';
	}

	const visibleRuns = $derived(expanded ? detail?.allRuns : detail?.activeRuns);
	const hiddenCount = $derived(
		(detail?.allRuns?.length ?? 0) - (detail?.activeRuns?.length ?? 0)
	);
</script>

<svelte:window
	onkeydown={(e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			open = true;
		}
		if (e.key === 'Escape' && open) {
			if (detail) back();
			else close();
		}
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/40 flex justify-center pt-24 px-4"
		role="dialog"
		aria-modal="true"
		aria-label="Search"
		tabindex="-1"
		onclick={close}
		onkeydown={closeFromBackdropKey}
	>
		<!-- Panel — stopPropagation prevents backdrop close when clicking inside -->
		<div
			class="w-3/5 bg-white rounded-xl shadow-2xl overflow-hidden h-fit"
			role="presentation"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<!-- Search input -->
			<div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
				{#if detail}
					<button
						onclick={back}
						class="text-gray-400 hover:text-gray-600 flex-shrink-0"
						title="Back to results"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15 19l-7-7 7-7"
							/></svg
						>
					</button>
				{:else}
					<svg
						class="w-4 h-4 text-gray-400 flex-shrink-0"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
					</svg>
				{/if}
				<input
					bind:this={inputEl}
					bind:value={query}
					oninput={handleInput}
					type="text"
					placeholder="Search by SO# (3+ chars)…"
					class="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
				/>
				{#if loading}
					<span class="text-xs text-gray-400">searching…</span>
				{/if}
				<kbd
					class="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 font-mono"
					>Esc</kbd
				>
			</div>

			<!-- Level 1: WO list -->
			{#if !detail}
				{#if query.trim().length >= 3 && !loading}
					{#if wos.length > 0}
						<div class="max-h-96 overflow-y-auto divide-y divide-gray-50">
							{#each wos as wo (wo.id)}
								<div
									class="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
								>
									<button
										class="flex-1 flex items-center gap-3 text-left min-w-0"
										onclick={() => selectWo(wo)}
									>
										<svg
											class="w-4 h-4 text-gray-400 flex-shrink-0"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
											/>
										</svg>
										<div class="flex-1 min-w-0">
											<span class="font-semibold text-gray-900 text-sm"
												>WO #{wo.so_number}</span
											>
											<span class="text-gray-500 text-sm ml-2 truncate"
												>{wo.customer_name} · {wo.job_name}</span
											>
										</div>
										<span class={woBadge(wo.status)}>{wo.status}</span>
									</button>
									<button
										class="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 px-1"
										title="Go to Work Order"
										onclick={() => navigate(`/wo/${wo.id}`)}
									>
										<svg
											class="w-4 h-4"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 5l7 7-7 7"
											/></svg
										>
									</button>
								</div>
							{/each}
						</div>
					{:else}
						<div class="px-4 py-6 text-center text-sm text-gray-400">
							No work orders found for <span class="font-mono">{query.trim()}</span>
						</div>
					{/if}
				{:else if !loading}
					<div class="px-4 py-6 text-center text-sm text-gray-400">
						Type 3 or more characters to search
					</div>
				{/if}

				<!-- Level 2: WO detail (runs + shipments) -->
			{:else}
				<div class="max-h-96 overflow-y-auto">
					<!-- WO header -->
					<div
						class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
					>
						<div>
							<span class="font-semibold text-gray-900 text-sm"
								>WO #{detail.wo.so_number}</span
							>
							<span class="text-gray-500 text-sm ml-2"
								>{detail.wo.customer_name} · {detail.wo.job_name}</span
							>
						</div>
						<div class="flex items-center gap-2">
							<span class={woBadge(detail.wo.status)}>{detail.wo.status}</span>
							<button
								class="text-gray-300 hover:text-blue-500 transition-colors px-1"
								title="Go to Work Order"
								onclick={() => navigate(`/wo/${detail.wo.id}`)}
							>
								<svg
									class="w-4 h-4"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 5l7 7-7 7"
									/></svg
								>
							</button>
						</div>
					</div>

					<!-- Production Runs -->
					{#if detail.allRuns.length > 0}
						<div>
							<div
								class="px-4 py-1.5 bg-gray-50 text-xs font-medium text-gray-400 uppercase tracking-wide"
							>
								Production Runs{detail.activeRuns.length > 0
									? ` · ${detail.activeRuns.length} active`
									: ''}
							</div>
							{#if visibleRuns.length > 0}
								{#each visibleRuns as run (run.id)}
									<button
										class="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
										onclick={() =>
											navigate(
												`/wo/${detail.wo.id}/confirm?highlight=${run.id}`
											)}
									>
										<svg
											class="w-4 h-4 text-gray-300 flex-shrink-0"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
											/>
										</svg>
										<span class="font-mono text-sm text-gray-700 flex-1"
											>{run.run_number}</span
										>
										{#if run.run_date}
											<span class="text-xs text-gray-400"
												>{fmtDate(run.run_date)}</span
											>
										{/if}
										<span class={statusBadge(run.status)}>{run.status}</span>
									</button>
								{/each}
							{:else if !expanded}
								<p class="px-4 py-2.5 text-sm text-gray-400">No active runs.</p>
							{/if}
							{#if hiddenCount > 0}
								<button
									class="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
									onclick={() => (expanded = !expanded)}
								>
									{expanded
										? 'Show active only'
										: `Show ${hiddenCount} completed run${hiddenCount === 1 ? '' : 's'}`}
								</button>
							{/if}
						</div>
					{/if}

					<!-- Shipments -->
					{#if detail.shipments.length > 0}
						<div>
							<div
								class="px-4 py-1.5 bg-gray-50 text-xs font-medium text-gray-400 uppercase tracking-wide"
							>
								Shipments
							</div>
							{#each detail.shipments as s (s.id)}
								<button
									class="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
									onclick={() => navigate(`/shipments/${s.id}`)}
								>
									<svg
										class="w-4 h-4 text-gray-300 flex-shrink-0"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
										/>
									</svg>
									<span class="font-mono text-sm text-gray-700 flex-1"
										>{s.shipment_number}</span
									>
									{#if s.ship_date}
										<span class="text-xs text-gray-400"
											>{fmtDate(s.ship_date)}</span
										>
									{/if}
									<span class={statusBadge(s.status)}>{s.status}</span>
								</button>
							{/each}
						</div>
					{/if}

					{#if detail.allRuns.length === 0 && detail.shipments.length === 0}
						<p class="px-4 py-4 text-sm text-gray-400">No runs or shipments yet.</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
