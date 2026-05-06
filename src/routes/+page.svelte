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
		background:
			linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.92)),
			#f8fafc;
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
		--section-bg: #eff6ff;
		--section-border: #bfdbfe;
		--card-bg: #f8fbff;
		--card-border: #dbeafe;
		--card-hover: #dbeafe;
		--card-active: #bfdbfe;
		--accent: #2563eb;
		padding: 1rem;
		border: 1px solid var(--section-border);
		border-radius: 0.5rem;
		background: var(--section-bg);
	}

	.activity-section.green {
		--section-bg: #edf7f1;
		--section-border: #bbdfc8;
		--card-bg: #f7fcf8;
		--card-border: #cfead8;
		--card-hover: #d5efdc;
		--card-active: #bbdfc8;
		--accent: #15803d;
	}

	.activity-section.rose {
		--section-bg: #fff1f2;
		--section-border: #fecdd3;
		--card-bg: #fff8f8;
		--card-border: #ffe4e6;
		--card-hover: #ffe0e4;
		--card-active: #fecdd3;
		--accent: #be123c;
	}

	.activity-section.amber {
		--section-bg: #fff7ed;
		--section-border: #fed7aa;
		--card-bg: #fffbf5;
		--card-border: #ffedd5;
		--card-hover: #fedfc1;
		--card-active: #fed7aa;
		--accent: #b45309;
	}

	.activity-section.violet {
		--section-bg: #f5f3ff;
		--section-border: #ddd6fe;
		--card-bg: #fbfaff;
		--card-border: #ede9fe;
		--card-hover: #e9e4ff;
		--card-active: #ddd6fe;
		--accent: #6d28d9;
	}

	.activity-section.slate {
		--section-bg: #f1f5f9;
		--section-border: #cbd5e1;
		--card-bg: #f8fafc;
		--card-border: #e2e8f0;
		--card-hover: #dfe7f0;
		--card-active: #cbd5e1;
		--accent: #475569;
	}

	.section-heading {
		display: grid;
		gap: 0.25rem;
		margin-bottom: 0.85rem;
	}

	.section-heading h2 {
		margin: 0;
		color: #0f172a;
		font-size: 1rem;
		font-weight: 750;
		line-height: 1.2;
	}

	.section-heading p {
		margin: 0;
		color: #475569;
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
