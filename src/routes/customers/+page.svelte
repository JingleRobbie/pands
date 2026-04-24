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
		<div class="card">
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Name</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">City</th>
						<th class="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each data.customers as c (c.id)}
						<tr
							class="hover:bg-gray-50 cursor-pointer"
							onclick={() => goto(`/customers/${c.id}`)}
						>
							<td class="px-4 py-3 font-medium text-gray-900">{c.name}</td>
							<td class="px-4 py-3 text-gray-600">{c.contact_name ?? '—'}</td>
							<td class="px-4 py-3 text-gray-600">{c.billing_city ?? '—'}</td>
							<td class="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
