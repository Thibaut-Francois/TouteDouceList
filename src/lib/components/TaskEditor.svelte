<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { PRIORITIES, PRIORITY_LABELS } from '$lib/priorities';
	import type { TaskPatch } from '$lib/server/repo/tasks';
	import type { ViewTask } from '$lib/tasks.svelte';

	let {
		task,
		onsave,
		onclose
	}: { task: ViewTask; onsave: (patch: TaskPatch) => void; onclose: () => void } = $props();

	// Le formulaire part d'une copie : la tâche affichée ne change qu'à l'enregistrement.
	const uid = $props.id();
	const initial = untrack(() => ({ ...task }));
	let title = $state(initial.title);
	let notes = $state(initial.notes);
	let priority = $state(initial.priority);
	let dueDate = $state(initial.dueDate ?? '');

	let dialog: HTMLDialogElement;
	onMount(() => dialog.showModal());

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		const patch: TaskPatch = {};
		if (trimmed !== initial.title) patch.title = trimmed;
		if (notes !== initial.notes) patch.notes = notes;
		if (priority !== initial.priority) patch.priority = priority;
		if ((dueDate || null) !== initial.dueDate) patch.dueDate = dueDate || null;
		onsave(patch);
		dialog.close();
	}
</script>

<dialog bind:this={dialog} {onclose} aria-labelledby="editor-title">
	<form onsubmit={submit}>
		<h2 id="editor-title">Modifier la tâche</h2>

		<div class="group">
			<label for="{uid}-title">Titre</label>
			<input id="{uid}-title" class="field" bind:value={title} required maxlength="500" />
		</div>

		<div class="group">
			<label for="{uid}-notes">Notes</label>
			<textarea id="{uid}-notes" class="field" bind:value={notes} rows="4" maxlength="10000"></textarea>
		</div>

		<div class="row">
			<div class="group">
				<label for="{uid}-priority">Priorité</label>
				<select id="{uid}-priority" class="field" bind:value={priority}>
					{#each PRIORITIES as p (p)}
						<option value={p}>{p} · {PRIORITY_LABELS[p]}</option>
					{/each}
				</select>
			</div>

			<div class="group">
				<label for="{uid}-due">Échéance</label>
				<span class="due">
					<input id="{uid}-due" class="field" type="date" bind:value={dueDate} />
					{#if dueDate}
						<button class="btn ghost" type="button" aria-label="Retirer l'échéance" onclick={() => (dueDate = '')}>
							✕
						</button>
					{/if}
				</span>
			</div>
		</div>

		<div class="actions">
			<button class="btn ghost" type="button" onclick={() => dialog.close()}>Annuler</button>
			<button class="btn primary" type="submit">Enregistrer</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		width: min(560px, calc(100vw - 24px));
		max-height: calc(100dvh - 24px);
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		color: var(--text);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}

	form {
		display: grid;
		gap: 14px;
	}

	h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.group {
		display: grid;
		gap: 6px;
	}

	.group > label {
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	textarea.field {
		padding: 10px 12px;
		resize: vertical;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.due {
		display: flex;
		gap: 6px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	@media (max-width: 480px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
