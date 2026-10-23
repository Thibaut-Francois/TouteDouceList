<script lang="ts">
	import { formatDue } from '$lib/dates';
	import { network } from '$lib/network.svelte';
	import type { ViewTask } from '$lib/tasks.svelte';
	import PriorityBadge from './PriorityBadge.svelte';

	let {
		task,
		today,
		oncomplete,
		onedit,
		onretry
	}: {
		task: ViewTask;
		today: string;
		oncomplete: () => void;
		onedit: () => void;
		onretry: () => void;
	} = $props();

	const late = $derived(task.dueDate !== null && task.dueDate < today);
	const failed = $derived(task.sync === 'failed');
</script>

<li class="task">
	<button
		class="check"
		type="button"
		role="checkbox"
		aria-checked="false"
		aria-label="Terminer « {task.title} »"
		disabled={failed || network.offline}
		onclick={oncomplete}
	></button>

	<button class="body" type="button" onclick={onedit}>
		<span class="title">{task.title}</span>
		<span class="meta">
			<PriorityBadge priority={task.priority} />
			{#if task.dueDate}
				<span class:late>{formatDue(task.dueDate, today)}</span>
			{/if}
			{#if task.recurrenceId}
				<span title="Récurrente" aria-label="Récurrente">↻</span>
			{/if}
			{#if task.notes}
				<span title="Notes" aria-label="Contient des notes">≡</span>
			{/if}
		</span>
	</button>

	{#if failed}
		<div class="failed">
			<span class="error">Non enregistrée</span>
			<button class="btn" type="button" onclick={onretry}>Réessayer</button>
		</div>
	{/if}
</li>

<style>
	.task {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}

	.check {
		flex: none;
		width: var(--tap);
		height: var(--tap);
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.check::before {
		content: '';
		display: block;
		width: 22px;
		height: 22px;
		margin: auto;
		border: 2px solid var(--text-muted);
		border-radius: 50%;
	}

	.check:hover::before {
		border-color: var(--accent);
	}

	.check:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.body {
		display: grid;
		flex: 1;
		gap: 2px;
		min-width: 0;
		min-height: var(--tap);
		padding: 6px 0;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.title {
		overflow-wrap: anywhere;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.late {
		color: var(--danger);
	}

	.failed {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 0 0 6px 52px;
		font-size: 0.9rem;
	}
</style>
