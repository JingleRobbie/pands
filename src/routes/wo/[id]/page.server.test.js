import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, deleteBranchLine, getAllCustomers, requireAdmin } = vi.hoisted(() => ({
	db: { query: vi.fn() },
	deleteBranchLine: vi.fn(),
	getAllCustomers: vi.fn(),
	requireAdmin: vi.fn(),
}));

vi.mock('$lib/db.js', () => ({ db }));
vi.mock('$lib/services/customers.js', () => ({ getAllCustomers }));
vi.mock('$lib/services/cutdown.js', () => ({ deleteBranchLine }));
vi.mock('$lib/auth.js', () => ({ requireAdmin }));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw { type: 'error', status, message };
	}),
	fail: vi.fn((status, data) => ({ status, data })),
	redirect: vi.fn((status, location) => {
		throw { type: 'redirect', status, location };
	}),
}));

const { actions, load } = await import('./+page.server.js');

function urlWithSearch(search = '') {
	return new URL(`http://localhost/wo/42${search}`);
}

describe('work order detail load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws 404 when the work order is missing', async () => {
		db.query.mockResolvedValueOnce([[undefined]]);

		await expect(
			load({
				params: { id: '42' },
				locals: { appUser: { id: 9 } },
				url: urlWithSearch(),
			})
		).rejects.toEqual({
			type: 'error',
			status: 404,
			message: 'Work order not found',
		});

		expect(getAllCustomers).not.toHaveBeenCalled();
	});

	it('loads work order detail data and creation flags', async () => {
		const wo = { id: 42, wo_number: 'WO-42', customer_display_name: 'Acme' };
		const rawLines = [
			{
				id: 100,
				wo_id: 42,
				parent_line_id: null,
				child_count: 0,
				rolls_produced: 10,
				qty: 10,
				reconciliation_status: 'CURRENT',
				instructions: 'Factory label',
				field_instructions: 'Factory label',
			},
		];
		const lines = [
			{
				...rawLines[0],
				line_type: 'UNBRANCHED',
				progress: {
					path: { label: 'Standard', class: 'badge-blue' },
					status: { label: 'Produced 10 / 10', class: 'badge-green' },
				},
				display_instructions: 'Factory label',
			},
		];
		const contacts = [{ id: 7, wo_id: 42, name: 'Dana' }];
		const customers = [{ id: 12, name: 'Acme' }];
		const user = { id: 9, name: 'Alex' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([rawLines])
			.mockResolvedValueOnce([contacts]);
		getAllCustomers.mockResolvedValueOnce(customers);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: user },
			url: urlWithSearch('?shipment_created=123&customer_created=1'),
		});

		expect(db.query).toHaveBeenCalledTimes(3);
		expect(db.query.mock.calls[0][1]).toEqual(['42']);
		expect(db.query.mock.calls[1][1]).toEqual(['42']);
		expect(db.query.mock.calls[2]).toEqual([
			'SELECT * FROM contacts WHERE wo_id = ? ORDER BY id',
			['42'],
		]);
		expect(getAllCustomers).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			wo,
			lines,
			billingLines: [],
			productionLines: [],
			productionGroupsByParent: {},
			unbranchedLines: lines,
			canComplete: true,
			contacts,
			customers,
			user,
			justCreatedShipmentId: 123,
			justCreatedCustomer: true,
		});
	});

	it('defaults creation flags when query params are absent or invalid', async () => {
		const wo = { id: 42, wo_number: 'WO-42' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([[]])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch('?shipment_created=not-a-number'),
		});

		expect(result.justCreatedShipmentId).toBeNull();
		expect(result.justCreatedCustomer).toBe(false);
	});

	it('uses field instructions for display only when they differ from imported instructions', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([
				[
					{
						id: 100,
						parent_line_id: null,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 0,
						qty: 1,
						reconciliation_status: 'CURRENT',
						instructions: 'Imported',
						field_instructions: 'Field override',
					},
					{
						id: 101,
						parent_line_id: null,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 0,
						qty: 1,
						reconciliation_status: 'CURRENT',
						instructions: 'Same',
						field_instructions: 'Same',
					},
					{
						id: 102,
						parent_line_id: null,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 0,
						qty: 1,
						reconciliation_status: 'CURRENT',
						instructions: 'Fallback',
						field_instructions: '',
					},
				],
			])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.unbranchedLines.map((line) => line.display_instructions)).toEqual([
			'Field override',
			'Same',
			'Fallback',
		]);
	});

	it('allows completion when billing parents are stale-free and production children are done', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		const rawLines = [
			{
				id: 100,
				parent_line_id: null,
				child_count: 2,
				rolls_produced: 0,
				qty: 10,
				reconciliation_status: 'CURRENT',
			},
			{
				id: 101,
				parent_line_id: 100,
				child_count: 0,
				rolls_produced: 5,
				qty: 5,
				reconciliation_status: 'CURRENT',
			},
			{
				id: 102,
				parent_line_id: 100,
				child_count: 0,
				rolls_produced: 5,
				qty: 5,
				reconciliation_status: 'CURRENT',
			},
		];
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([rawLines])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.canComplete).toBe(true);
		expect(result.billingLines).toHaveLength(1);
		expect(result.productionLines).toHaveLength(2);
		expect(result.productionGroupsByParent[100]).toHaveLength(1);
		expect(result.productionGroupsByParent[100][0]).toMatchObject({
			child_count: 2,
			child_ids: [101, 102],
			qty: 10,
			rolls_produced: 10,
		});
		expect(result.unbranchedLines).toHaveLength(0);
	});

	it('keeps distinct branch child widths as separate production display groups', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([
				[
					{
						id: 100,
						parent_line_id: null,
						child_count: 2,
						rolls_produced: 0,
						qty: 10,
						reconciliation_status: 'CURRENT',
					},
					{
						id: 101,
						parent_line_id: 100,
						child_count: 0,
						rollfor: 'Roof',
						facing: 'Vinyl',
						thickness_in: 3.5,
						width_in: 18,
						length_ft: 75,
						sqft: 563,
						rolls_produced: 1,
						rolls_scheduled: 0,
						qty: 5,
						path_type: null,
						reconciliation_status: 'CURRENT',
					},
					{
						id: 102,
						parent_line_id: 100,
						child_count: 0,
						rollfor: 'Roof',
						facing: 'Vinyl',
						thickness_in: 3.5,
						width_in: 24,
						length_ft: 75,
						sqft: 750,
						rolls_produced: 0,
						rolls_scheduled: 1,
						qty: 5,
						path_type: null,
						reconciliation_status: 'CURRENT',
					},
				],
			])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.productionGroupsByParent[100]).toMatchObject([
			{ child_count: 1, child_ids: [101], width_in: 18, qty: 5, sqft: 563 },
			{ child_count: 1, child_ids: [102], width_in: 24, qty: 5, sqft: 750 },
		]);
	});

	it('marks faced unbranched lines as standard production progress', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([
				[
					{
						id: 100,
						parent_line_id: null,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 3,
						rolls_scheduled: 0,
						qty: 10,
						reconciliation_status: 'CURRENT',
					},
				],
			])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.unbranchedLines[0].progress).toEqual({
			path: { label: 'Standard', class: 'badge-blue' },
			status: { label: 'Produced 3 / 10', class: 'badge-blue' },
		});
	});

	it('marks raw unbranched lines as direct ship and shipped when directly shipped', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([
				[
					{
						id: 100,
						parent_line_id: null,
						child_count: 0,
						facing: 'Unfaced',
						rolls_produced: 0,
						rolls_scheduled: 0,
						rolls_shipped: 0,
						direct_shipments_shipped: 1,
						qty: 4,
						reconciliation_status: 'CURRENT',
					},
				],
			])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.unbranchedLines[0].progress).toEqual({
			path: { label: 'Direct Ship', class: 'badge-gray' },
			status: { label: 'Shipped 4 / 4', class: 'badge-green' },
		});
	});

	it('aggregates branch child progress onto the billing line', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([
				[
					{
						id: 100,
						parent_line_id: null,
						child_count: 2,
						facing: 'Vinyl',
						rolls_produced: 0,
						rolls_scheduled: 0,
						qty: 10,
						reconciliation_status: 'CURRENT',
					},
					{
						id: 101,
						parent_line_id: 100,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 2,
						rolls_scheduled: 1,
						qty: 5,
						reconciliation_status: 'CURRENT',
					},
					{
						id: 102,
						parent_line_id: 100,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 0,
						rolls_scheduled: 0,
						qty: 5,
						reconciliation_status: 'CURRENT',
					},
				],
			])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.billingLines[0].progress).toEqual({
			path: { label: 'Branch', class: 'badge-gray' },
			status: { label: 'Scheduled 1', class: 'badge-blue' },
		});
	});

	it('marks lines with active cut-down activity as cut-down scheduled', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([
				[
					{
						id: 100,
						parent_line_id: null,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 0,
						rolls_scheduled: 0,
						active_cut_down_count: 1,
						cut_down_rolls_scheduled: 2,
						qty: 8,
						reconciliation_status: 'CURRENT',
					},
				],
			])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.unbranchedLines[0].progress).toEqual({
			path: { label: 'Cut-Down', class: 'badge-amber' },
			status: { label: 'Scheduled 2', class: 'badge-blue' },
		});
	});

	it('keeps stale reconciliation state visible in billing progress', async () => {
		const wo = { id: 42, wo_number: 'WO-42', status: 'OPEN' };
		db.query
			.mockResolvedValueOnce([[wo]])
			.mockResolvedValueOnce([
				[
					{
						id: 100,
						parent_line_id: null,
						child_count: 0,
						facing: 'Vinyl',
						rolls_produced: 10,
						rolls_scheduled: 0,
						qty: 10,
						reconciliation_status: 'STALE',
					},
				],
			])
			.mockResolvedValueOnce([[]]);
		getAllCustomers.mockResolvedValueOnce([]);

		const result = await load({
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
			url: urlWithSearch(),
		});

		expect(result.unbranchedLines[0].progress).toEqual({
			path: { label: 'Standard', class: 'badge-blue' },
			status: { label: 'Stale', class: 'badge-amber' },
		});
	});
});

describe('work order detail branch actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('does not delete a branch for non-admin users', async () => {
		const denied = { status: 403, data: { error: 'Admin required' } };
		requireAdmin.mockReturnValueOnce(denied);

		const result = await actions.deleteBranch({
			request: new Request('http://localhost/wo/42?/deleteBranch', {
				method: 'POST',
				body: new URLSearchParams({ line_id: '34' }),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toBe(denied);
		expect(deleteBranchLine).not.toHaveBeenCalled();
	});

	it('deletes a branch through the service and redirects to the work order', async () => {
		requireAdmin.mockReturnValueOnce(null);
		deleteBranchLine.mockResolvedValueOnce(2);

		await expect(
			actions.deleteBranch({
				request: new Request('http://localhost/wo/42?/deleteBranch', {
					method: 'POST',
					body: new URLSearchParams({ line_id: '34' }),
				}),
				params: { id: '42' },
				locals: { appUser: { id: 9 } },
			})
		).rejects.toEqual({ type: 'redirect', status: 303, location: '/wo/42' });

		expect(deleteBranchLine).toHaveBeenCalledWith(34, 42, 9);
	});

	it('returns a user-facing error when branch deletion is blocked', async () => {
		requireAdmin.mockReturnValueOnce(null);
		deleteBranchLine.mockRejectedValueOnce(
			new Error('Cannot delete branch because it has downstream cut-down activity.')
		);

		const result = await actions.deleteBranch({
			request: new Request('http://localhost/wo/42?/deleteBranch', {
				method: 'POST',
				body: new URLSearchParams({ line_id: '34' }),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: {
				branchError: 'Cannot delete branch because it has downstream cut-down activity.',
			},
		});
	});

	it('returns a user-facing error when branch id is missing', async () => {
		requireAdmin.mockReturnValueOnce(null);

		const result = await actions.deleteBranch({
			request: new Request('http://localhost/wo/42?/deleteBranch', {
				method: 'POST',
				body: new URLSearchParams(),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { branchError: 'Branch line is required.' },
		});
		expect(deleteBranchLine).not.toHaveBeenCalled();
	});

	it('does not update field instructions for non-admin users', async () => {
		const denied = { status: 403, data: { error: 'Admin required' } };
		requireAdmin.mockReturnValueOnce(denied);

		const result = await actions.updateFieldInstructions({
			request: new Request('http://localhost/wo/42?/updateFieldInstructions', {
				method: 'POST',
				body: new URLSearchParams({
					line_id: '34',
					field_instructions: 'Install first',
				}),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toBe(denied);
		expect(db.query).not.toHaveBeenCalled();
	});

	it('updates field instructions for a line in the current work order', async () => {
		requireAdmin.mockReturnValueOnce(null);
		db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

		const result = await actions.updateFieldInstructions({
			request: new Request('http://localhost/wo/42?/updateFieldInstructions', {
				method: 'POST',
				body: new URLSearchParams({
					line_id: '34',
					field_instructions: 'Install first',
				}),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ fieldInstructionsUpdated: true });
		expect(db.query).toHaveBeenCalledWith(
			'UPDATE work_order_lines SET field_instructions = ? WHERE id = ? AND wo_id = ?',
			['Install first', 34, '42']
		);
	});

	it('clears field instructions to fall back to imported instructions', async () => {
		requireAdmin.mockReturnValueOnce(null);
		db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

		const result = await actions.updateFieldInstructions({
			request: new Request('http://localhost/wo/42?/updateFieldInstructions', {
				method: 'POST',
				body: new URLSearchParams({ line_id: '34', field_instructions: '   ' }),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({ fieldInstructionsUpdated: true });
		expect(db.query).toHaveBeenCalledWith(
			'UPDATE work_order_lines SET field_instructions = ? WHERE id = ? AND wo_id = ?',
			[null, 34, '42']
		);
	});

	it('returns a user-facing error when the field instruction line is missing', async () => {
		requireAdmin.mockReturnValueOnce(null);

		const result = await actions.updateFieldInstructions({
			request: new Request('http://localhost/wo/42?/updateFieldInstructions', {
				method: 'POST',
				body: new URLSearchParams({ field_instructions: 'Install first' }),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 400,
			data: { instructionError: 'Line ID required.' },
		});
	});

	it('returns a user-facing error when the field instruction line is outside the work order', async () => {
		requireAdmin.mockReturnValueOnce(null);
		db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

		const result = await actions.updateFieldInstructions({
			request: new Request('http://localhost/wo/42?/updateFieldInstructions', {
				method: 'POST',
				body: new URLSearchParams({
					line_id: '34',
					field_instructions: 'Install first',
				}),
			}),
			params: { id: '42' },
			locals: { appUser: { id: 9 } },
		});

		expect(result).toEqual({
			status: 404,
			data: { instructionError: 'Work order line not found.' },
		});
	});
});
