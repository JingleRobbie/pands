<script>
	import { fly, fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { fmtDate, fmtSqft } from '$lib/utils.js';

	let { matrix, open = $bindable(false) } = $props();
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black/40 z-40"
		onclick={() => (open = false)}
		role="presentation"
		transition:fade={{ duration: 200 }}
	></div>

	<div
		class="fixed top-0 right-0 h-full w-[90vw] bg-white shadow-2xl z-50 flex flex-col"
		transition:fly={{ x: 600, duration: 280, opacity: 1 }}
	>
		<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
			<span class="text-sm font-semibold text-gray-700">Inventory Outlook</span>
			<button onclick={() => (open = false)} class="btn-secondary btn-sm">Close</button>
		</div>

		<div class="overflow-auto flex-1">
			<table class="matrix-table w-full text-left border-collapse">
				<thead>
					<tr>
						<th class="min-w-[120px]">Customer/Vendor</th>
						<th class="min-w-[140px]">Description</th>
						<th class="min-w-[90px]">Order #</th>
						<th class="min-w-[70px]">Date</th>
						<th class="min-w-[70px]">Ship</th>
						<th class="min-w-[70px]">Facing</th>
						{#each matrix.skus as sku (sku.id)}
							{@const trimmed = sku.display_label.trim()}
							<th class="sku-col-start min-w-[50px] align-bottom">
								<div class="h-16 relative overflow-visible">
									<span
										class="absolute bottom-1 left-1/2 inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-normal"
									>
										{trimmed} Δ
									</span>
								</div>
							</th>
							<th class="min-w-[80px] align-bottom">
								<div class="h-16 relative overflow-visible">
									<span
										class="absolute bottom-1 left-1/2 inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-normal text-gray-400"
									>
										{trimmed} bal
									</span>
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr class="row-balance">
						<td></td>
						<td class="font-semibold text-gray-700">Current Inventory</td>
						<td></td>
						<td class="text-xs text-gray-500">today</td>
						<td></td>
						<td></td>
						{#each matrix.skus as sku (sku.id)}
							{@const cell = matrix.balanceRow.cells[sku.id]}
							<td class="sku-col-start"></td>
							<td
								class="text-right font-mono text-sm {cell?.runningTotal < 0
									? 'sqft-negative'
									: ''}"
							>
								{fmtSqft(cell?.runningTotal ?? 0)}
							</td>
						{/each}
					</tr>
					{#each matrix.rows as row (row.rowType + (row.soLineId ?? row.objectId))}
						{@const href =
							row.rowType === 'po'
								? `/po/${row.objectId}`
								: row.rowType === 'production'
									? `/production/${row.objectId}/confirm`
									: `/so/${row.objectId}`}
						<tr
							class="row-{row.rowType} cursor-pointer"
							onclick={() => {
								open = false;
								goto(href);
							}}
						>
							<td class="text-gray-600 text-sm">{row.partyName ?? ''}</td>
							<td class="font-medium">
								{#if row.rowType === 'po'}
									{@const sc =
										row.status === 'CANCELLED' ? 'badge-red' : 'badge-blue'}
									<span class={sc}>{row.status}</span>
								{:else if row.rowType === 'production'}
									{row.description}
								{:else}
									<span class="text-amber-700">{row.description}</span>
								{/if}
							</td>
							<td
								class="text-sm {row.rowType === 'po'
									? 'text-blue-700'
									: row.rowType === 'unscheduled'
										? 'text-amber-700'
										: 'text-gray-600'}"
							>
								{row.soNumber || row.poNumber}
							</td>
							<td class="text-sm text-gray-600">
								{#if row.eventDate}
									{fmtDate(row.eventDate)}
								{:else if row.rowType === 'unscheduled'}
									<span class="text-amber-600 font-semibold">?</span>
								{/if}
							</td>
							<td class="text-sm text-gray-600">
								{#if row.shipDate}{fmtDate(row.shipDate)}{/if}
							</td>
							<td class="text-sm text-gray-600">{row.facing ?? ''}</td>
							{#each matrix.skus as sku (sku.id)}
								{@const cell = row.cells[sku.id]}
								<td
									class="sku-col-start text-right font-mono text-sm"
									onclick={(e) => e.stopPropagation()}
								>
									{#if cell?.delta != null}
										{#if cell.delta > 0}
											<span class="sqft-positive">+{fmtSqft(cell.delta)}</span
											>
										{:else}
											<span class="sqft-negative"
												>({fmtSqft(Math.abs(cell.delta))})</span
											>
										{/if}
									{/if}
								</td>
								<td
									class="text-right font-mono text-sm {cell?.runningTotal < 0
										? 'sqft-negative'
										: 'text-gray-500'}"
									onclick={(e) => e.stopPropagation()}
								>
									{fmtSqft(cell?.runningTotal ?? 0)}
								</td>
							{/each}
						</tr>
					{:else}
						<tr>
							<td colspan="100" class="py-6 text-center text-gray-400 text-sm"
								>No upcoming activity for these SKUs.</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
