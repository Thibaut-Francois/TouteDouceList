<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { lightDismiss } from '$lib/actions/light-dismiss';
	import { todayInParis } from '$lib/dates';
	import type { Stage, StageDeletion, StageInput } from '$lib/server/repo/projects';

	let {
		stage = null,
		otherStages = [],
		openCount = 0,
		onsave,
		ondelete,
		onclose
	}: {
		stage?: Stage | null;
		/** Les autres étapes du chantier, vers lesquelles déplacer les tâches avant suppression. */
		otherStages?: Pick<Stage, 'id' | 'name'>[];
		/** Tâches ouvertes de l'étape. */
		openCount?: number;
		onsave: (input: StageInput) => Promise<boolean>;
		ondelete?: (choice: StageDeletion) => Promise<boolean>;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	const initial = untrack(() => stage);
	let name = $state(initial?.name ?? '');
	let startDate = $state(initial?.startDate ?? todayInParis());
	let endDate = $state(initial?.endDate ?? initial?.startDate ?? todayInParis());
	let saving = $state(false);

	const datesInvalid = $derived(startDate !== '' && endDate !== '' && startDate > endDate);

	// Suppression : confirmation dans la fenêtre ; s'il reste des tâches ouvertes, déplacer ou supprimer.
	let confirming = $state(false);
	let fate = $state<'move' | 'delete'>(untrack(() => (otherStages.length ? 'move' : 'delete')));
	let target = $state(untrack(() => otherStages[0]?.id ?? ''));

	let dialog: HTMLDialogElement;
	onMount(() => dialog.showModal());

	async function run(action: () => Promise<boolean>) {
		if (saving) return;
		saving = true;
		const ok = await action();
		saving = false;
		if (ok) dialog.close();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || !startDate || !endDate || datesInvalid) return;
		run(() => onsave({ name: name.trim(), startDate, endDate }));
	}

	function remove() {
		if (!ondelete) return;
		const choice: StageDeletion =
			openCount === 0 ? {} : fate === 'move' ? { moveTo: target } : { deleteOpen: true };
		run(() => ondelete(choice));
	}
</script>

<dialog class="modal" bind:this={dialog} use:lightDismiss {onclose} aria-labelledby="{uid}-title">
	<form class="modal-body" onsubmit={submit}>
		<h2 id="{uid}-title">{initial ? 'Modifier l’étape' : 'Nouvelle étape'}</h2>

		<div class="group">
			<label for="{uid}-name">Nom</label>
			<input id="{uid}-name" class="field" bind:value={name} required maxlength="500" />
		</div>

		<div class="row">
			<div class="group">
				<label for="{uid}-start">Début</label>
				<input id="{uid}-start" class="field" type="date" bind:value={startDate} required />
			</div>
			<div class="group">
				<label for="{uid}-end">Fin</label>
				<input
					id="{uid}-end"
					class="field"
					type="date"
					bind:value={endDate}
					min={startDate}
					required
					aria-invalid={datesInvalid}
					aria-describedby="{uid}-dates"
				/>
			</div>
		</div>
		{#if datesInvalid}
			<p id="{uid}-dates" class="error" role="alert">La fin doit être le même jour que le début, ou après.</p>
		{/if}

		{#if initial && ondelete}
			{#if confirming}
				<fieldset class="delete">
					<legend>Supprimer « {initial.name} » ?</legend>
					{#if openCount > 0}
						<p class="muted">
							{openCount === 1 ? 'Il reste 1 tâche ouverte.' : `Il reste ${openCount} tâches ouvertes.`}
						</p>
						{#if otherStages.length}
							<label class="choice">
								<input type="radio" bind:group={fate} value="move" />
								Déplacer ses tâches vers
								<select class="field" bind:value={target} aria-label="Étape de destination" disabled={fate !== 'move'}>
									{#each otherStages as other (other.id)}
										<option value={other.id}>{other.name}</option>
									{/each}
								</select>
							</label>
						{/if}
						<label class="choice">
							<input type="radio" bind:group={fate} value="delete" />
							Supprimer les tâches ouvertes (les faites restent dans l’archive)
						</label>
					{/if}
					<div class="actions">
						<button class="btn ghost" type="button" onclick={() => (confirming = false)}>Annuler</button>
						<button class="btn danger" type="button" disabled={saving} onclick={remove}>Supprimer l’étape</button>
					</div>
				</fieldset>
			{:else}
				<button class="btn ghost danger-text" type="button" onclick={() => (confirming = true)}>
					Supprimer l’étape…
				</button>
			{/if}
		{/if}

		<div class="actions">
			<button class="btn ghost" type="button" onclick={() => dialog.close()}>Annuler</button>
			<button class="btn primary" type="submit" disabled={saving || datesInvalid}>
				{initial ? 'Enregistrer' : 'Ajouter'}
			</button>
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

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.error {
		margin: 0;
	}

	.delete {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 12px;
		border: 1px solid var(--danger);
		border-radius: var(--radius);
	}

	.delete legend {
		padding: 0 6px;
		font-weight: 600;
	}

	.delete p {
		margin: 0;
	}

	.choice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.choice select {
		width: auto;
		flex: 1;
		min-width: 140px;
	}

	.btn.danger {
		border-color: var(--danger);
		background: var(--danger);
		color: var(--accent-text);
		font-weight: 600;
	}

	.danger-text {
		justify-self: start;
		color: var(--danger);
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
