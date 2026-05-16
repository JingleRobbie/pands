<script>
	let { data } = $props();

	const activityGroups = [
		{
			title: 'Plan',
			description: 'Inventory position, production schedule, and calendar views.',
			tone: 'blue',
			links: [
				{ href: '/matrix', label: 'Inventory Matrix', detail: 'Current and projected SKU balances' },
				{ href: '/calendar', label: 'Production Calendar', detail: 'Daily production and PO arrivals' },
				{
					href: '/shipments/calendar',
					label: 'Shipment Calendar',
					detail: 'Scheduled shipment dates',
				},
			],
		},
		{
			title: 'Buy',
			description: 'Purchase material and receive incoming stock.',
			tone: 'green',
			links: [
				{ href: '/po', label: 'Purchase Orders', detail: 'Review open and received POs' },
				{ href: '/po/new', label: 'Create PO', detail: 'Enter a new material purchase' },
				{ href: '/po/import', label: 'Import POs', detail: 'Load purchase order data in bulk' },
				{ href: '/receiving', label: 'Receiving', detail: 'Receive material into inventory' },
			],
		},
		{
			title: 'Customers',
			description: 'Customer records and account setup.',
			tone: 'rose',
			links: [
				{ href: '/customers', label: 'Customers', detail: 'Manage customer records' },
				{ href: '/customers/new', label: 'Add Customer', detail: 'Create a new customer' },
			],
		},
		{
			title: 'Make',
			description: 'Work orders, production runs, confirmation, and reversals.',
			tone: 'amber',
			links: [
				{ href: '/wo', label: 'Work Orders', detail: 'Review production demand' },
				{ href: '/wo/import', label: 'Import WOs', detail: 'Load work orders in bulk' },
				{ href: '/production', label: 'Production Runs', detail: 'Schedule and confirm production' },
				{ href: '/production/unproduce', label: 'Unproduce', detail: 'Reverse confirmed production runs' },
			],
		},
		{
			title: 'Ship',
			description: 'Prepare, confirm, edit, and bill shipments.',
			tone: 'violet',
			links: [
				{ href: '/shipments', label: 'Shipments', detail: 'Review shipment status' },
				{ href: '/shipments/new', label: 'Create Shipment', detail: 'Build a shipment from open orders' },
			],
		},
		{
			title: 'Admin',
			description: 'Inventory corrections and personal settings.',
			tone: 'slate',
			adminOnly: true,
			links: [
				{ href: '/inventory/counts', label: 'Inventory Counts', detail: 'Review inventory count history' },
				{ href: '/inventory/count', label: 'New Count', detail: 'Record SKU count adjustments' },
				{ href: '/settings/users', label: 'Users', detail: 'Manage app users and access' },
			],
		},
	];

	const visibleGroups = $derived(
		activityGroups.filter((group) => !group.adminOnly || data.appUser?.role === 'admin')
	);
</script>

<svelte:head><title>PandS - Activities</title></svelte:head>

<main class="landing-shell">
	<header class="landing-header">
		<div>
			<p class="eyebrow">PandS Inventory</p>
			<h1>Activities</h1>
			<p class="landing-copy">Choose the work area you need now.</p>
		</div>
		<div class="landing-actions">
			{#if data.appUser}
				<span>{data.appUser.display_name}</span>
				<a href="/settings" class="btn-secondary btn-sm">Settings</a>
				<a href="/logout" class="btn-secondary btn-sm">Sign out</a>
			{:else}
				<a href="/login" class="btn-primary btn-sm">Sign in</a>
			{/if}
		</div>
	</header>

	<div class="activity-sections">
		{#each visibleGroups as group (group.title)}
			<section class="activity-section {group.tone}" aria-labelledby="group-{group.title}">
				<div class="section-heading">
					<h2 id="group-{group.title}">{group.title}</h2>
					<p>{group.description}</p>
				</div>
				<div class="activity-grid">
					{#each group.links as link (link.href)}
						<a class="activity-card" href={link.href}>
							<span class="activity-title">{link.label}</span>
							<span class="activity-detail">{link.detail}</span>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</main>

<style>
	.landing-shell {
		min-height: 100%;
		padding: 1.5rem;
		background: #f9fafb;
	}

	.landing-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 auto 1.5rem;
		max-width: 72rem;
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		color: #64748b;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		color: #0f172a;
		font-size: 1.875rem;
		font-weight: 750;
		line-height: 1.1;
	}

	.landing-copy {
		margin: 0.35rem 0 0;
		color: #64748b;
		font-size: 0.95rem;
	}

	.landing-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.5rem;
		color: #64748b;
		font-size: 0.875rem;
	}

	.activity-sections {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		max-width: 72rem;
		margin: 0 auto;
	}

	.activity-section {
		--section-bg: #1e3a5f;
		--section-border: #162d4a;
		--card-bg: #f4f7fb;
		--card-border: #c8d9ee;
		--card-hover: #e4edf8;
		--card-active: #c8d9ee;
		--accent: #60a5fa;
		padding: 1rem;
		border: 1px solid var(--section-border);
		border-radius: 0.5rem;
		background: var(--section-bg);
	}

	.activity-section.green {
		--section-bg: #4d5b2b;
		--section-border: #3a4520;
		--card-bg: #f5f7f0;
		--card-border: #c9d4aa;
		--card-hover: #e4ebd0;
		--card-active: #c9d4aa;
		--accent: #a3c45a;
	}

	.activity-section.rose {
		--section-bg: #760528;
		--section-border: #5a0420;
		--card-bg: #fdf5f7;
		--card-border: #e8bcc8;
		--card-hover: #f5d8e2;
		--card-active: #e8bcc8;
		--accent: #f472b6;
	}

	.activity-section.amber {
		--section-bg: #5c3a1e;
		--section-border: #452c16;
		--card-bg: #fdf8f3;
		--card-border: #e8cfb0;
		--card-hover: #f5e4cc;
		--card-active: #e8cfb0;
		--accent: #f59e0b;
	}

	.activity-section.violet {
		--section-bg: #3b1f5e;
		--section-border: #2d1748;
		--card-bg: #f8f5fd;
		--card-border: #d4c0ee;
		--card-hover: #ead8f8;
		--card-active: #d4c0ee;
		--accent: #c084fc;
	}

	.activity-section.slate {
		--section-bg: #a09590;
		--section-border: #8a7e78;
		--card-bg: #f8f6f5;
		--card-border: #d9d4c4;
		--card-hover: #ede8df;
		--card-active: #d9d4c4;
		--accent: #44403c;
	}

	.section-heading {
		display: grid;
		gap: 0.25rem;
		margin-bottom: 0.85rem;
	}

	.section-heading h2 {
		margin: 0;
		color: #ffffff;
		font-size: 1rem;
		font-weight: 750;
		line-height: 1.2;
	}

	.section-heading p {
		margin: 0;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.82rem;
		line-height: 1.35;
	}

	.activity-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.activity-card {
		display: grid;
		gap: 0.2rem;
		min-height: 5rem;
		padding: 0.85rem;
		border: 1px solid var(--card-border);
		border-radius: 0.5rem;
		background: var(--card-bg);
		color: #0f172a;
		text-decoration: none;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
		transition:
			background-color 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.activity-card:hover,
	.activity-card:focus-visible {
		background: var(--card-hover);
		border-color: var(--section-border);
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
		transform: translateY(-1px);
	}

	.activity-card:active {
		background: var(--card-active);
		box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
		transform: translateY(0);
	}

	.activity-card:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.activity-title {
		color: #0f172a;
		font-size: 0.95rem;
		font-weight: 750;
		line-height: 1.2;
	}

	.activity-detail {
		color: #475569;
		font-size: 0.78rem;
		line-height: 1.3;
	}

	@media (max-width: 980px) {
		.activity-sections {
			grid-template-columns: 1fr;
		}
	}

	/* Dark mode */
	:global(.dark) .landing-shell { background: #111827; }
	:global(.dark) .eyebrow, :global(.dark) .landing-copy, :global(.dark) .landing-actions { color: #9ca3af; }
	:global(.dark) h1 { color: #f1f5f9; }
	:global(.dark) .section-heading h2 { color: #f1f5f9; }
	:global(.dark) .section-heading p { color: #9ca3af; }
	:global(.dark) .activity-section { --section-bg:#1e2a3a;--section-border:#2d4a6a;--card-bg:#1a2535;--card-border:#2a3d56;--card-hover:#243352;--card-active:#2d4060;--accent:#60a5fa; }
	:global(.dark) .activity-section.green { --section-bg:#1a2d24;--section-border:#2d4a38;--card-bg:#172620;--card-border:#264033;--card-hover:#1f3529;--card-active:#2a4035;--accent:#4ade80; }
	:global(.dark) .activity-section.rose { --section-bg:#2d1a1e;--section-border:#4a2a30;--card-bg:#261518;--card-border:#3d2228;--card-hover:#331e24;--card-active:#402530;--accent:#fb7185; }
	:global(.dark) .activity-section.amber { --section-bg:#2d2215;--section-border:#4a3820;--card-bg:#261d12;--card-border:#3d3020;--card-hover:#33271a;--card-active:#403020;--accent:#fbbf24; }
	:global(.dark) .activity-section.violet { --section-bg:#221a2d;--section-border:#3a2a50;--card-bg:#1d1526;--card-border:#31244a;--card-hover:#2a1e3d;--card-active:#33254d;--accent:#a78bfa; }
	:global(.dark) .activity-section.slate { --section-bg:#1e2535;--section-border:#2d3748;--card-bg:#1a2030;--card-border:#28354a;--card-hover:#232d40;--card-active:#2d3a50;--accent:#94a3b8; }
	:global(.dark) .activity-card { color:#f1f5f9; box-shadow:0 1px 2px rgba(0,0,0,0.4); }
	:global(.dark) .activity-card:hover, :global(.dark) .activity-card:focus-visible { box-shadow:0 8px 20px rgba(0,0,0,0.5); }
	:global(.dark) .activity-title { color:#f1f5f9; }
	:global(.dark) .activity-detail { color:#9ca3af; }

	@media (max-width: 640px) {
		.landing-shell {
			padding: 1rem;
		}

		.landing-header {
			display: grid;
			gap: 0.85rem;
		}

		.landing-actions {
			justify-content: flex-start;
		}

		.activity-section {
			padding: 0.85rem;
		}

		.activity-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
