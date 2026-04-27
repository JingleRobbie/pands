<script>
	import { goto } from '$app/navigation';
	import { fmtDate } from '$lib/utils.js';

	let { data } = $props();

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

	let view = $state('week'); // 'week' | '2weeks' | 'month'
	let today = new Date();
	let monthYear = $state({ year: today.getFullYear(), month: today.getMonth() + 1 });
	let events = $state({});
	let showPastShipped = $state(false);

	function monday(d) {
		const dt = new Date(d);
		const day = dt.getDay();
		const diff = day === 0 ? -6 : 1 - day;
		dt.setDate(dt.getDate() + diff);
		return dt;
	}

	function pad(n) {
		return String(n).padStart(2, '0');
	}
	function isoDate(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	const todayStr = isoDate(today);

	function dateRange() {
		if (view === 'month') {
			const { year, month } = monthYear;
			const start = `${year}-${pad(month)}-01`;
			const lastDay = new Date(year, month, 0).getDate();
			const end = `${year}-${pad(month)}-${pad(lastDay)}`;
			return { start, end, pastDrafts: false };
		}
		if (view === 'week') {
			const start = new Date(today);
			start.setDate(start.getDate() - 3);
			const end = new Date(today);
			end.setDate(end.getDate() + 7);
			return { start: isoDate(start), end: isoDate(end), pastDrafts: true };
		}
		// 2weeks: Mon of current week through 13 days
		const mon = monday(today);
		const end = new Date(mon);
		end.setDate(end.getDate() + 13);
		return { start: isoDate(mon), end: isoDate(end), pastDrafts: false };
	}

	async function loadEvents() {
		const { start, end, pastDrafts } = dateRange();
		const params = new URLSearchParams({ start, end });
		if (pastDrafts) params.set('past_drafts', '1');
		const res = await fetch(`/shipments/calendar/events?${params}`);
		events = await res.json();
	}

	function setView(v) {
		view = v;
		showPastShipped = false;
		loadEvents();
	}

	function prevMonth() {
		if (monthYear.month === 1) monthYear = { year: monthYear.year - 1, month: 12 };
		else monthYear = { ...monthYear, month: monthYear.month - 1 };
		loadEvents();
	}
	function nextMonth() {
		if (monthYear.month === 12) monthYear = { year: monthYear.year + 1, month: 1 };
		else monthYear = { ...monthYear, month: monthYear.month + 1 };
		loadEvents();
	}

	function tabClass(val) {
		return view === val
			? 'rounded-full px-3 py-1 text-sm font-medium bg-gray-800 text-white'
			: 'rounded-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900';
	}

	const dates = $derived(Object.keys(events).sort());

	// Week view splits dates into three buckets
	const overdueDates = $derived(
		view === 'week'
			? dates.filter((d) => d < todayStr && events[d].some((s) => s.status !== 'SHIPPED'))
			: []
	);
	const pastShippedDates = $derived(
		view === 'week'
			? dates.filter((d) => d < todayStr && !events[d].some((s) => s.status !== 'SHIPPED'))
			: []
	);
	const currentFutureDates = $derived(
		view === 'week' ? dates.filter((d) => d >= todayStr) : dates
	);

	function isToday(dateStr) {
		return dateStr === todayStr;
	}

	$effect(() => {
		loadEvents();
	});
</script>

<svelte:head><title>Shipping Calendar — PandS</title></svelte:head>

{#snippet dateCard(dateStr)}
	{@const isPast = dateStr < todayStr}
	{@const hasDraft = events[dateStr].some((s) => s.status !== 'SHIPPED')}
	{@const isOverdue = isPast && hasDraft}
	<div class="card">
		<div class="card-header !py-2 {isOverdue ? 'bg-amber-50 border-b border-amber-200' : ''}">
			<span
				class="font-semibold text-sm {isOverdue
					? 'text-amber-700'
					: isToday(dateStr)
						? 'text-blue-600'
						: 'text-gray-700'}"
			>
				{fmtDate(dateStr)}{isToday(dateStr) ? ' · Today' : ''}{isOverdue
					? ' · Overdue'
					: ''}
			</span>
			<span class="text-xs {isOverdue ? 'text-amber-500' : 'text-gray-400'}">
				{events[dateStr].length} shipment{events[dateStr].length === 1 ? '' : 's'}
			</span>
		</div>
		<table class="min-w-full divide-y divide-gray-100 text-sm">
			<tbody>
				{#each events[dateStr] as s (s.id)}
					<tr
						class="hover:bg-gray-50 cursor-pointer"
						onclick={() => goto(`/shipments/${s.id}`)}
					>
						<td class="px-4 py-1.5 font-mono text-gray-700 w-28">{s.shipment_number}</td
						>
						<td class="px-4 py-1.5 text-gray-600 w-80">{s.customer_name}</td>
						<td class="px-4 py-1.5 text-gray-500">{s.job_name}</td>
						<td class="px-4 py-1.5 text-gray-400 w-32">WO #{s.so_number}</td>
						<td class="px-4 py-1.5 text-right w-24">
							<span class="badge-{s.status === 'SHIPPED' ? 'green' : 'amber'}"
								>{s.status}</span
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
	<h1 class="text-lg font-semibold text-gray-900">Shipping Calendar</h1>
	{#if view === 'month'}
		<div class="flex items-center gap-2">
			<button onclick={prevMonth} class="btn-secondary btn-sm">&#8592;</button>
			<span class="font-medium text-gray-700 w-36 text-center">
				{MONTH_NAMES[monthYear.month - 1]}
				{monthYear.year}
			</span>
			<button onclick={nextMonth} class="btn-secondary btn-sm">&#8594;</button>
		</div>
	{/if}
</header>

<main class="p-6">
	<nav class="flex gap-1 mb-6">
		<button class={tabClass('week')} onclick={() => setView('week')}>This Week</button>
		<button class={tabClass('2weeks')} onclick={() => setView('2weeks')}>2 Weeks</button>
		<button class={tabClass('month')} onclick={() => setView('month')}>Month</button>
	</nav>

	{#if dates.length === 0}
		<div class="card">
			<div class="card-body text-sm text-gray-400">
				No shipments scheduled for this period.
			</div>
		</div>
	{:else if view === 'week'}
		<div class="space-y-2">
			{#each overdueDates as dateStr (dateStr)}
				{@render dateCard(dateStr)}
			{/each}

			{#if pastShippedDates.length > 0}
				<button
					onclick={() => (showPastShipped = !showPastShipped)}
					class="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
				>
					<svg
						class="w-3 h-3 transition-transform {showPastShipped ? 'rotate-90' : ''}"
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
					{showPastShipped ? 'Hide' : 'Show'}
					{pastShippedDates.length} prior day{pastShippedDates.length === 1 ? '' : 's'}
				</button>
				{#if showPastShipped}
					{#each pastShippedDates as dateStr (dateStr)}
						{@render dateCard(dateStr)}
					{/each}
				{/if}
			{/if}

			{#each currentFutureDates as dateStr (dateStr)}
				{@render dateCard(dateStr)}
			{/each}
		</div>
	{:else}
		<div class="space-y-2">
			{#each dates as dateStr (dateStr)}
				{@render dateCard(dateStr)}
			{/each}
		</div>
	{/if}
</main>
