<script>
	let { data } = $props();
	const { wo, labels } = $derived(data);

	// Group labels into pairs for two-per-page layout
	const ROLLFOR_CATEGORIES = [
		{ value: 'roof',      label: 'Roof',      match: (v) => /^roof$/i.test(v) },
		{ value: 'sidewalls', label: 'Sidewalls',  match: (v) => /^(sw|sidewall)$/i.test(v) },
		{ value: 'endwalls',  label: 'Endwalls',   match: (v) => /^(ew|end\s*wall)$/i.test(v) },
		{ value: 'stock',     label: 'Stock',      match: (v) => /^stock$/i.test(v) },
		{ value: 'other',     label: 'Other',      match: (v) => !/^(roof|sw|sidewall|ew|end\s*wall|stock)$/i.test(v) },
	];

	let filterCategory = $state('');

	const activeCategories = $derived.by(() => {
		const present = new Set();
		for (const l of labels) {
			const v = (l.rollfor ?? '').trim();
			for (const cat of ROLLFOR_CATEGORIES) {
				if (cat.match(v)) { present.add(cat.value); break; }
			}
		}
		return ROLLFOR_CATEGORIES.filter((c) => present.has(c.value));
	});

	const filteredLabels = $derived.by(() => {
		if (!filterCategory) return labels;
		const cat = ROLLFOR_CATEGORIES.find((c) => c.value === filterCategory);
		return cat ? labels.filter((l) => cat.match((l.rollfor ?? '').trim())) : labels;
	});
	const pages = $derived.by(() => {
		const result = [];
		for (let i = 0; i < filteredLabels.length; i += 2) {
			result.push(filteredLabels.slice(i, i + 2));
		}
		return result;
	});

	const JM_BOILERPLATE = `JOB SITE STORAGE: Store insulation in a dry area that is elevated above the ground or slab. Avoid contact with water or uncured concrete. Protect from weather.

WARNING
Possible cancer hazard by inhalation. Can cause respiratory skin and eye irritation.
PRECAUTIONARY MEASURES
Avoid breathing fiberglass dust, and contact with skin and eyes. Use a NIOSH approved dust/mist respirator. Wear long-sleeved, loose fitting clothing, gloves, and eye protection. Wash work clothes separately from other clothing, rinse washer thoroughly. Operations such as sawing, blowing, tear out, and spraying may generate airborne fiber concentrations requiring additional protection.
FIRST AID MEASURES
EYE CONTACT - Flush eyes with water to remove dust. If symptoms persist, seek medical attention.
SKIN CONTACT - Wash affected areas gently with soap and warm water after handling.

For additional information regarding respirators, medical and scientific research on glass fibers, refer to the latest version of Johns Manville's Material Safety Data Sheet or bulletin HSE 64C available from Johns Manville Product Information Center, P.O. Box 5108, Denver, CO 80217-5108. 1-800-654-3103 or call collect 1-303-978-4900`;

	const CT_BOILERPLATE = `JOB SITE STORAGE: Store insulation in a dry area that is elevated above the ground or slab. Avoid contact with water or uncured concrete. Protect from weather.

WARNING
Possible cancer hazard by inhalation. Can cause respiratory skin and eye irritation.
PRECAUTIONARY MEASURES
Avoid breathing fiberglass dust, and contact with skin and eyes. Use a NIOSH approved dust/mist respirator. Wear long-sleeved, loose fitting clothing, gloves, and eye protection. Wash work clothes separately from other clothing, rinse washer thoroughly.
FIRST AID MEASURES
EYE CONTACT - Flush eyes with water to remove dust. If symptoms persist, seek medical attention.
SKIN CONTACT - Wash affected areas gently with soap and warm water after handling.

For product safety information refer to the CertainTeed Corporation Safety Data Sheet available at certainteed.com or by calling 1-800-233-8990.`;

	function boilerplate(vendor) {
		return vendor === 'Certainteed' ? CT_BOILERPLATE : JM_BOILERPLATE;
	}
</script>

<svelte:head>
	<title>Labels - WO #{wo.so_number}</title>
</svelte:head>

<div class="no-print screen-toolbar">
	<a href="/wo/{wo.id}" class="btn-secondary btn-sm">← WO #{wo.so_number}</a>
	{#if activeCategories.length > 1}
		<select bind:value={filterCategory} class="form-select text-sm py-1 w-48">
			<option value="">All</option>
			{#each activeCategories as cat (cat.value)}
				<option value={cat.value}>{cat.label}</option>
			{/each}
		</select>
	{/if}
	<span class="text-sm text-gray-600">{filteredLabels.length} label{filteredLabels.length === 1 ? '' : 's'} · {pages.length} page{pages.length === 1 ? '' : 's'}</span>
	<a
		href="/wo/{wo.id}/labels/pdf{filterCategory ? '?category=' + filterCategory : ''}"
		target="_blank"
		rel="noopener"
		class="btn-primary btn-sm"
	>PDF</a>
</div>

<div class="label-sheet-wrapper">
	{#each pages as pair, pageIdx (pageIdx)}
		<div class="label-page">
			{#each pair as label (label.id + '-' + label.rollNumber)}
				<div class="label">
					<div class="label-top">
						<div class="label-company">{wo.customer_name}</div>
						<div class="label-roll-num">{label.rollNumber}</div>
					</div>

					<div class="label-meta">
						<div class="label-meta-row">
							<span class="label-meta-key">PO NUMBER</span>
							<span class="label-meta-val">{wo.customer_po ?? wo.so_number}</span>
						</div>
						<div class="label-meta-row">
							<span class="label-meta-key">PROJECT NAME</span>
							<span class="label-meta-val label-meta-val--bold">{wo.job_name}</span>
						</div>
					</div>

					<div class="label-dims">
						<div class="label-dim">
							<div class="label-dim-title">Thickness</div>
							<div class="label-dim-value">{label.thickness_in}"</div>
						</div>
						<div class="label-dim">
							<div class="label-dim-title">Width</div>
							<div class="label-dim-value">{label.raw_roll_width_in}"</div>
						</div>
						<div class="label-dim">
							<div class="label-dim-title">Length</div>
							<div class="label-dim-value">{label.raw_roll_length_ft}'</div>
						</div>
					</div>

					{#if label.field_instructions}
						<div class="label-instructions">
							<div class="label-instructions-title">INSTRUCTIONS</div>
							<div class="label-instructions-text">{label.field_instructions}</div>
						</div>
					{/if}

					<hr class="label-divider" />

					<div class="label-boilerplate">
						{#each boilerplate(label.raw_vendor).split('\n') as line, i (i)}
							{#if line.trim() === ''}
								<br />
							{:else if line === 'WARNING' || line === 'PRECAUTIONARY MEASURES' || line === 'FIRST AID MEASURES'}
								<strong>{line}</strong><br />
							{:else if line.startsWith('JOB SITE STORAGE:')}
								<span><strong>JOB SITE STORAGE:</strong>{line.slice('JOB SITE STORAGE:'.length)}</span><br />
							{:else}
								<span>{line}</span><br />
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	/* Screen chrome */
	.screen-toolbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		background: white;
	}
	:global(.dark) .screen-toolbar {
		background: #1f2937;
		border-color: #374151;
	}

	/* Sheet wrapper - gray desk on screen */
	.label-sheet-wrapper {
		background: #94a3b8;
		padding: 2rem;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}
	:global(.dark) .label-sheet-wrapper {
		background: #1e293b;
	}

	/* One sheet = two labels */
	.label-page {
		width: 8.5in;
		background: white;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
		display: flex;
		flex-direction: column;
	}

	/* Individual label - half a sheet */
	.label {
		width: 100%;
		min-height: 5.5in;
		padding: 0.5in 0.75in 0.4in;
		box-sizing: border-box;
		border-bottom: 2px dashed #999;
		color: #000;
		font-family: Arial, Helvetica, sans-serif;
	}
	.label:last-child {
		border-bottom: none;
	}

	/* Top row: company + roll# */
	.label-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.1in;
	}
	.label-company {
		font-size: 28pt;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.5px;
	}
	.label-roll-num {
		font-size: 18pt;
		font-weight: 700;
		margin-top: 4px;
	}

	/* PO / Project meta rows */
	.label-meta {
		margin-bottom: 0.1in;
	}
	.label-meta-row {
		display: flex;
		align-items: baseline;
		gap: 0.2in;
		border-top: 1px solid #000;
		padding: 2px 0;
	}
	.label-meta-key {
		font-size: 9pt;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		min-width: 1.1in;
	}
	.label-meta-val {
		font-size: 11pt;
	}
	.label-meta-val--bold {
		font-size: 16pt;
		font-weight: 900;
		text-transform: uppercase;
	}

	/* Dimensions block */
	.label-dims {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 2px solid #000;
		border-bottom: 2px solid #000;
		margin-bottom: 0.1in;
	}
	.label-dim {
		text-align: center;
		padding: 0.05in 0;
		border-right: 1px solid #ccc;
	}
	.label-dim:last-child {
		border-right: none;
	}
	.label-dim-title {
		font-size: 13pt;
		font-weight: 700;
	}
	.label-dim-value {
		font-size: 42pt;
		font-weight: 900;
		line-height: 1;
	}

	/* Instructions */
	.label-instructions {
		text-align: center;
		margin-bottom: 0.08in;
	}
	.label-instructions-title {
		font-size: 11pt;
		font-weight: 700;
		text-decoration: underline;
	}
	.label-instructions-text {
		font-size: 12pt;
		font-weight: 600;
	}

	/* Divider */
	.label-divider {
		border: none;
		border-top: 1px solid #000;
		margin: 0.08in 0;
	}

	/* Boilerplate */
	.label-boilerplate {
		font-size: 7pt;
		line-height: 1.35;
	}

	/* Print */
	@page {
		size: letter portrait;
		margin: 0.35in;
	}
	@media print {
		.screen-toolbar { display: none !important; }
		.label-sheet-wrapper {
			background: transparent;
			padding: 0;
			display: block;
		}
		.label-page {
			display: block;
			width: 100%;
			height: 10.3in;
			box-shadow: none;
			page-break-after: always;
			overflow: hidden;
		}
		.label-page:last-child {
			page-break-after: avoid;
		}
		.label {
			display: block;
			height: 5.15in;
			min-height: unset;
			overflow: hidden;
			page-break-inside: avoid;
		}
	}
</style>
