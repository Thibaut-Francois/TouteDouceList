<script lang="ts">
	import { formatDue, todayInParis } from '$lib/dates';
	import { DEFAULT_PRIORITY, PRIORITY_LABELS } from '$lib/priorities';
	import { parseQuickAdd } from '$lib/quick-add';
	import type { NewTask } from '$lib/tasks.svelte';

	let { onadd }: { onadd: (task: NewTask) => void } = $props();

	let value = $state('');
	let open = $state(false);
	let input: HTMLInputElement;

	const parsed = $derived(value.trim() ? parseQuickAdd(value, todayInParis()) : null);

	/** Appelé de façon synchrone dans le geste (bouton, raccourci) pour que le clavier mobile s'ouvre. */
	export function focus() {
		input.focus();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!parsed) return;
		onadd({
			title: parsed.title,
			priority: parsed.priority ?? DEFAULT_PRIORITY,
			dueDate: parsed.dueDate
		});
		value = '';
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		value = '';
		input.blur();
	}
</script>

<form class="quick-add" class:open onsubmit={submit}>
	<input
		bind:this={input}
		bind:value
		class="field"
		type="text"
		placeholder="Nouvelle tâche… (!1 demain)"
		aria-label="Nouvelle tâche"
		autocomplete="off"
		enterkeyhint="done"
		maxlength="500"
		onfocus={() => (open = true)}
		onblur={() => (open = value !== '')}
		{onkeydown}
	/>
	{#if parsed && (parsed.priority || parsed.dueDate)}
		<p class="hint" aria-live="polite">
			{#if parsed.priority}Priorité {PRIORITY_LABELS[parsed.priority]}{/if}
			{#if parsed.priority && parsed.dueDate}·{/if}
			{#if parsed.dueDate}Échéance {formatDue(parsed.dueDate, todayInParis()).toLowerCase()}{/if}
		</p>
	{/if}
</form>

<button class="fab" class:hidden={open} type="button" aria-label="Ajouter une tâche" onclick={focus}>
	<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
</button>

<style>
	.quick-add {
		margin: 4px 0 16px;
	}

	.field {
		min-height: 48px;
		font-size: 1rem;
	}

	.hint {
		margin: 6px 4px 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.fab {
		display: none;
	}

	@media (max-width: 640px) {
		/* Toujours hors du flux : ouvrir ou fermer le champ ne décale jamais la liste sous le doigt. */
		.quick-add {
			position: fixed;
			top: env(safe-area-inset-top);
			left: 0;
			right: 0;
			z-index: 25;
			margin: 0;
			padding: 8px 16px;
			border-bottom: 1px solid var(--border);
			background: var(--bg);
			box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
		}

		/* Fermé, il reste focusable (pas de display: none) pour que le focus suive le tap sans délai. */
		.quick-add:not(.open) {
			right: auto;
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			opacity: 0;
			pointer-events: none;
		}

		.fab {
			position: fixed;
			right: calc(20px + env(safe-area-inset-right));
			bottom: calc(20px + env(safe-area-inset-bottom));
			z-index: 20;
			display: grid;
			place-items: center;
			width: 60px;
			height: 60px;
			border: none;
			border-radius: 50%;
			background: var(--accent);
			color: var(--accent-text);
			box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
			cursor: pointer;
		}

		.fab.hidden {
			display: none;
		}

		.fab svg {
			width: 28px;
			height: 28px;
			fill: none;
			stroke: currentColor;
			stroke-width: 2.5;
			stroke-linecap: round;
		}
	}
</style>
