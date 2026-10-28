<script lang="ts">
	import { onMount } from 'svelte';
	import { lightDismiss } from '$lib/actions/light-dismiss';
	import { formatDateTitle, formatInstant, formatTaskDate } from '$lib/dates';
	import { network } from '$lib/network.svelte';
	import { PRIORITY_LABELS } from '$lib/priorities';
	import type { Task } from '$lib/server/repo/tasks';
	import { today } from '$lib/today.svelte';
	import PriorityBadge from './PriorityBadge.svelte';

	let {
		task,
		onreopen,
		ondelete,
		onclose
	}: {
		task: Task;
		onreopen: () => Promise<boolean>;
		ondelete: () => Promise<boolean>;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	let confirming = $state(false);
	let dialog: HTMLDialogElement;
	onMount(() => dialog.showModal());

	async function run(action: () => Promise<boolean>) {
		if (await action()) dialog.close();
	}
</script>

<dialog class="modal" bind:this={dialog} use:lightDismiss {onclose} aria-labelledby="{uid}-title">
	<div class="modal-body">
		<h2 id="{uid}-title">{task.title}</h2>

		<dl>
			<dt>Priorité</dt>
			<dd class="priority">
				<PriorityBadge priority={task.priority} />
				{PRIORITY_LABELS[task.priority]}
			</dd>

			<dt>Échéance</dt>
			{#if task.dueDate}
				<dd title={formatDateTitle(task.dueDate)}>
					{formatTaskDate(task.dueDate, today.value, { capitalize: true })}
				</dd>
			{:else}
				<dd>Aucune</dd>
			{/if}

			<dt>Créée le</dt>
			<dd>{formatInstant(task.createdAt)}</dd>

			<dt>Terminée le</dt>
			<dd>{task.completedAt ? formatInstant(task.completedAt) : '—'}</dd>

			{#if task.recurrenceId}
				<dt>Type</dt>
				<dd>Récurrente ↻</dd>
			{/if}
		</dl>

		<section aria-labelledby="{uid}-notes">
			<h3 id="{uid}-notes">Notes</h3>
			{#if task.notes.trim()}
				<p class="notes">{task.notes}</p>
			{:else}
				<p class="muted">Aucune note.</p>
			{/if}
		</section>

		{#if confirming}
			<div class="actions" role="group" aria-label="Confirmer la suppression">
				<span class="question">Supprimer définitivement ?</span>
				<button class="btn ghost" type="button" onclick={() => (confirming = false)}>Annuler</button>
				<button class="btn danger" type="button" onclick={() => run(ondelete)}>Supprimer</button>
			</div>
		{:else}
			<div class="actions">
				<button
					class="btn ghost danger-text"
					type="button"
					disabled={network.offline}
					onclick={() => (confirming = true)}
				>
					Supprimer
				</button>
				<span class="spacer"></span>
				<button class="btn ghost" type="button" onclick={() => dialog.close()}>Fermer</button>
				<button class="btn primary" type="button" disabled={network.offline} onclick={() => run(onreopen)}>
					Rouvrir
				</button>
			</div>
		{/if}
	</div>
</dialog>

<style>
	h2 {
		overflow-wrap: anywhere;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
		margin: 0;
	}

	dt {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	dd {
		margin: 0;
	}

	.priority {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	h3 {
		margin: 0 0 6px;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 400;
	}

	.notes {
		max-height: 40dvh;
		margin: 0;
		overflow-y: auto;
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--bg);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	section .muted {
		margin: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.question {
		flex: 1;
	}

	.spacer {
		flex: 1;
	}

	.btn.danger {
		border-color: var(--danger);
		background: var(--danger);
		color: var(--accent-text);
		font-weight: 600;
	}

	.danger-text {
		color: var(--danger);
	}
</style>
