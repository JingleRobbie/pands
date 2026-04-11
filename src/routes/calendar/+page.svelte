<script>
	let today = new Date();
	let year = $state(today.getFullYear());
	let month = $state(today.getMonth() + 1); // 1-based

	let events = $state({});

	const MONTH_NAMES = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	async function loadEvents() {
		const res = await fetch(`/calendar/events?year=${year}&month=${month}`);
		events = await res.json();
	}

	function prev() {
		if (month === 1) {
			month = 12;
			year--;
		} else {
			month--;
		}
		loadEvents();
	}
	function next() {
		if (month === 12) {
			month = 1;
			year++;
		} else {
			month++;
		}
		loadEvents();
	}

	// Build calendar grid
	let cells = $derived(() => {
		const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
		const daysInMonth = new Date(year, month, 0).getDate();
		const arr = [];
		for (let i = 0; i < firstDow; i++) arr.push(null);
		for (let d = 1; d <= daysInMonth; d++) arr.push(d);
		// pad to full weeks
		while (arr.length % 7 !== 0) arr.push(null);
		return arr;
	});

	function pad(n) {
		return String(n).padStart(2, '0');
	}
	function dateKey(d) {
		return `${year}-${pad(month)}-${pad(d)}`;
	}
	function isToday(d) {
		return (
			d &&
			year === today.getFullYear() &&
			month === today.getMonth() + 1 &&
			d === today.getDate()
		);
	}

	// Load on mount
	$effect(() => {
		loadEvents();
	});
</script>

<svelte:head><title>Calendar — PandS</title></svelte:head>

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Calendar</h1>
	<div class="flex items-center gap-3">
		<button onclick={prev} class="btn-secondary btn-sm">&#8592;</button>
		<span class="font-medium text-gray-700 w-36 text-center"
			>{MONTH_NAMES[month - 1]} {year}</span
		>
		<button onclick={next} class="btn-secondary btn-sm">&#8594;</button>
	</div>
</header>
<main class="p-6">
	<div class="grid grid-cols-7 text-xs font-semibold text-gray-500 border-b border-gray-200 mb-1">
		{#each DAY_NAMES as name (name)}
			<div class="py-1 text-center">{name}</div>
		{/each}
	</div>

	<div
		class="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-md overflow-hidden"
	>
		{#each cells() as cell, i (i)}
			<div
				class="bg-white min-h-24 p-1 {isToday(cell)
					? 'ring-2 ring-inset ring-blue-400'
					: ''}"
			>
				{#if cell}
					<div
						class="text-xs font-semibold mb-1 {isToday(cell)
							? 'text-blue-600'
							: 'text-gray-500'}"
					>
						{cell}
					</div>
					{#each events[dateKey(cell)] ?? [] as ev (ev.id)}
						<div
							class="text-xs rounded px-1 py-0.5 mb-0.5 leading-tight truncate
				{ev.type === 'po' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}"
							title={ev.label}
						>
							{ev.label}
						</div>
					{/each}
				{/if}
			</div>
		{/each}
	</div>

	<div class="flex gap-4 mt-3 text-xs text-gray-500">
		<span class="flex items-center gap-1"
			><span class="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200"></span> PO
			Arrival</span
		>
		<span class="flex items-center gap-1"
			><span class="inline-block w-3 h-3 rounded bg-green-100 border border-green-200"></span> Production
			Run</span
		>
	</div>
</main>
