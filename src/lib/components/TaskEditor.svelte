<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { lightDismiss } from '$lib/actions/light-dismiss';
	import { PRIORITIES, PRIORITY_LABELS } from '$lib/priorities';
	import type { Task, TaskWrite } from '$lib/server/repo/tasks';

	type Option = { id: string; label: string };

	let {
		task,
		assignees = [],
		stages = [],
		onsave,
		onclose
	}: {
		task: Task;
		/** Tâche de chantier dans Pro : à qui l'attribuer. */
		assignees?: Option[];
		/** Tâche de chantier : dans quelle étape la ranger. */
		stages?: Option[];
		onsave: (patch: TaskWrite) => void;
		onclose: () => void;
	} = $props();

	// Le formulaire part d'une copie : la tâche affichée ne change qu'à l'enregistrement.
	const uid = $props.id();
	const initial = untrack(() => ({ ...task }));
	let title = $state(initial.title);
	let notes = $state(initial.notes);
	let priority = $state(initial.priority);
	let dueDate = $state(initial.dueDate ?? '');
	let profileId = $state(initial.profileId ?? '');
	let stageId = $state(initial.stageId ?? '');

	let dialog: HTMLDialogElement;
	onMount(() => {
		dialog.showModal();
		// Sur écran tactile, showModal donnerait le focus au titre et ouvrirait le clavier.
		if (matchMedia('(pointer: coarse)').matches) dialog.focus();
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		const patch: TaskWrite = {};
		if (trimmed !== initial.title) patch.title = trimmed;
		if (notes !== initial.notes) patch.notes = notes;
		if (priority !== initial.priority) patch.priority = priority;
		if ((dueDate || null) !== initial.dueDate) patch.dueDate = dueDate || null;
		if (assignees.length && profileId !== initial.profileId) patch.profileId = profileId;
		if (stages.length && stageId !== initial.stageId) patch.stageId = stageId;
		onsave(patch);
		dialog.close();
	}
</script>

<dialog
	class="modal"
	bind:this={dialog}
	use:lightDismiss
	{onclose}
	aria-labelledby="editor-title"
	tabindex="-1"
>
	<form class="modal-body" onsubmit={submit}>
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

		{#if assignees.length || stages.length}
			<div class="row">
				{#if assignees.length}
					<div class="group">
						<label for="{uid}-assignee">Attribuée à</label>
						<select id="{uid}-assignee" class="field" bind:value={profileId}>
							{#each assignees as a (a.id)}
								<option value={a.id}>{a.label}</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if stages.length}
					<div class="group">
						<label for="{uid}-stage">Étape</label>
						<select id="{uid}-stage" class="field" bind:value={stageId}>
							{#each stages as s (s.id)}
								<option value={s.id}>{s.label}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>
		{/if}

		<div class="actions">
			<button class="btn ghost" type="button" onclick={() => dialog.close()}>Annuler</button>
			<button class="btn primary" type="submit">Enregistrer</button>
		</div>
	</form>
</dialog>

<style>
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
