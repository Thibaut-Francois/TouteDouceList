<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { lightDismiss } from '$lib/actions/light-dismiss';
	import type { ProjectInput } from '$lib/server/repo/projects';

	let {
		project = null,
		onsave,
		onclose
	}: {
		project?: ProjectInput | null;
		onsave: (input: ProjectInput) => Promise<boolean>;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	const initial = untrack(() => project);
	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let saving = $state(false);

	let dialog: HTMLDialogElement;
	onMount(() => dialog.showModal());

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || saving) return;
		saving = true;
		const ok = await onsave({ name: name.trim(), description });
		saving = false;
		// Après une création, la page a déjà changé : la fenêtre n'existe plus.
		if (ok) dialog?.close();
	}
</script>

<dialog class="modal" bind:this={dialog} use:lightDismiss {onclose} aria-labelledby="{uid}-title">
	<form class="modal-body" onsubmit={submit}>
		<h2 id="{uid}-title">{initial ? 'Modifier le chantier' : 'Nouveau chantier'}</h2>

		<div class="group">
			<label for="{uid}-name">Nom</label>
			<input id="{uid}-name" class="field" bind:value={name} required maxlength="500" />
		</div>

		<div class="group">
			<label for="{uid}-description">Description</label>
			<textarea id="{uid}-description" class="field" bind:value={description} rows="3" maxlength="10000"
			></textarea>
		</div>

		<div class="actions">
			<button class="btn ghost" type="button" onclick={() => dialog.close()}>Annuler</button>
			<button class="btn primary" type="submit" disabled={saving}>
				{initial ? 'Enregistrer' : 'Créer'}
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

	textarea.field {
		padding: 10px 12px;
		resize: vertical;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
</style>
