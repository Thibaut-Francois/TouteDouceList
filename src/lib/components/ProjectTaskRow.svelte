<script lang="ts">
	import { formatDateTitle, formatTaskDate } from '$lib/dates';
	import { isOutsideStage, type StageDates } from '$lib/projects';
	import type { Task } from '$lib/server/repo/tasks';
	import { isProfileId, PROFILE_NAMES } from '$lib/spaces';
	import PriorityBadge from './PriorityBadge.svelte';

	let {
		task,
		stage,
		today,
		showAssignee,
		disabled,
		ontoggle,
		onedit
	}: {
		task: Task;
		stage: StageDates;
		today: string;
		/** Chantier de Pro : on affiche à qui la tâche est attribuée. */
		showAssignee: boolean;
		disabled: boolean;
		ontoggle: () => void;
		onedit: () => void;
	} = $props();

	const done = $derived(task.status === 'done');
	const outside = $derived(isOutsideStage(task.dueDate, stage));
	const assignee = $derived(isProfileId(task.profileId) ? PROFILE_NAMES[task.profileId] : '');
</script>

<!-- Une tâche faite reste visible, cochée, pour suivre l'avancement de l'étape. -->
<li class="task" class:done>
	<button
		class="check"
		type="button"
		role="checkbox"
		aria-checked={done}
		aria-label="{done ? 'Rouvrir' : 'Terminer'} « {task.title} »"
		{disabled}
		onclick={ontoggle}
	></button>

	<button class="body" type="button" onclick={onedit} {disabled}>
		<span class="title">{task.title}</span>
		<span class="meta">
			<PriorityBadge priority={task.priority} />
			{#if task.dueDate}
				<span class:late={!done && task.dueDate < today} title={formatDateTitle(task.dueDate)}>
					{formatTaskDate(task.dueDate, today, { capitalize: true })}
				</span>
				{#if outside}
					<span class="outside" title="Échéance en dehors des dates de l’étape">⚠ hors étape</span>
				{/if}
			{/if}
			{#if showAssignee && assignee}
				<span class="assignee" title="Attribuée à {assignee}">{assignee}</span>
			{/if}
			{#if task.notes}
				<span title="Notes" aria-label="Contient des notes">≡</span>
			{/if}
		</span>
	</button>
</li>

<style>
	.task {
		display: flex;
		align-items: center;
		gap: 4px 8px;
		border-bottom: 1px solid var(--border);
	}

	.task:last-child {
		border-bottom: none;
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
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		margin: auto;
		border: 2px solid var(--text-muted);
		border-radius: 50%;
		color: var(--accent-text);
		font-size: 0.8rem;
		font-weight: 700;
	}

	.done .check::before {
		content: '✓';
		border-color: var(--success);
		background: var(--success);
	}

	.check:hover::before {
		border-color: var(--accent);
	}

	.check:disabled,
	.body:disabled {
		cursor: default;
	}

	.check:disabled {
		opacity: 0.5;
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

	.done .title {
		color: var(--text-muted);
		text-decoration: line-through;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.late {
		color: var(--danger);
	}

	.outside {
		color: var(--warning);
	}

	.assignee {
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: 999px;
	}
</style>
