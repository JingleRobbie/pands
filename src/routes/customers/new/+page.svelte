<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const woId = $derived(form?.woId ?? data.woId);
</script>

<div class="p-6 max-w-md">
	<h1 class="text-xl font-semibold text-gray-900 mb-6">New Customer</h1>

	<form method="POST" use:enhance class="space-y-4">
		{#if form?.error}
			<p class="text-red-600 text-sm">{form.error}</p>
		{/if}

		<input type="hidden" name="wo_id" value={woId ?? ''} />
		<div class="card card-body space-y-4">
			<div>
				<label for="name" class="form-label">Company Name *</label>
				<input id="name" name="name" class="form-input" required value={form?.name ?? ''} />
			</div>
			<div>
				<label for="phone" class="form-label">Office Phone</label>
				<input id="phone" name="phone" class="form-input" value={form?.phone ?? ''} />
			</div>
		</div>

		<div class="flex gap-3">
			<button type="submit" class="btn-primary">Create Customer</button>
			<a href={woId ? `/wo/${woId}` : '/customers'} class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
