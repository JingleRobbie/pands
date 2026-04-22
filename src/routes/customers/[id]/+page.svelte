<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="p-6 max-w-md">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-xl font-semibold text-gray-900">{data.customer.name}</h1>
		<a href="/customers" class="btn-secondary btn-sm">← All Customers</a>
	</div>

	<form method="POST" use:enhance class="space-y-4">
		{#if form?.error}<p class="text-red-600 text-sm">{form.error}</p>{/if}
		{#if form?.success}<p class="text-green-600 text-sm">Saved.</p>{/if}

		<div class="card card-body space-y-4">
			<div>
				<label for="name" class="form-label">Company Name *</label>
				<input
					id="name"
					name="name"
					class="form-input"
					required
					value={data.customer.name}
				/>
			</div>
			<div>
				<label for="phone" class="form-label">Office Phone</label>
				<input
					id="phone"
					name="phone"
					class="form-input"
					value={data.customer.phone ?? ''}
				/>
			</div>
		</div>

		<button type="submit" class="btn-primary">Save Changes</button>
	</form>

	{#if data.wos.length > 0}
		<div class="mt-8">
			<h2 class="font-medium text-gray-700 mb-3">Linked Work Orders</h2>
			<div class="card">
				<table class="min-w-full divide-y divide-gray-200 text-sm">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left font-medium text-gray-500">WO #</th>
							<th class="px-4 py-3 text-left font-medium text-gray-500">Job</th>
							<th class="px-4 py-3 text-left font-medium text-gray-500">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 bg-white">
						{#each data.wos as wo (wo.id)}
							<tr>
								<td class="px-4 py-3">
									<a href="/wo/{wo.id}" class="text-blue-600 hover:underline"
										>{wo.so_number}</a
									>
								</td>
								<td class="px-4 py-3 text-gray-600">{wo.job_name}</td>
								<td class="px-4 py-3">
									<span
										class="badge-{wo.status === 'COMPLETE'
											? 'green'
											: wo.status === 'CANCELLED'
												? 'red'
												: 'amber'}">{wo.status}</span
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
