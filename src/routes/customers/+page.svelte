<script>
	import { goto } from '$app/navigation';
	let { data } = $props();
</script>

<div class="p-6">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">Customers</h1>
		<a href="/customers/new" class="btn-primary">New Customer</a>
	</div>

	{#if data.customers.length === 0}
		<p class="text-gray-500 text-sm">
			No customers yet. <a href="/customers/new" class="text-blue-600 hover:underline"
				>Add one.</a
			>
		</p>
	{:else}
		<div class="card overflow-x-auto">
			<table class="dense-list-table min-w-[32rem]">
				<thead>
					<tr>
						<th class="text-left">Name</th>
						<th class="text-left">Contact</th>
						<th class="text-left">City</th>
						<th class="text-left">Phone</th>
					</tr>
				</thead>
				<tbody>
					{#each data.customers as c (c.id)}
						<tr class="cursor-pointer" onclick={() => goto(`/customers/${c.id}`)}>
							<td class="font-medium text-gray-900">{c.name}</td>
							<td class="text-gray-600">{c.contact_name ?? '—'}</td>
							<td class="text-gray-600">{c.billing_city ?? '—'}</td>
							<td class="text-gray-600">{c.phone ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
