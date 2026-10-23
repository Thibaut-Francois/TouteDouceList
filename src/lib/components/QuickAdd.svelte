<script lang="ts">
	import { formatDue, todayInParis } from '$lib/dates';
	import { network } from '$lib/network.svelte';
	import { DEFAULT_PRIORITY, PRIORITIES, PRIORITY_COLORS, PRIORITY_LABELS } from '$lib/priorities';
	import { parseQuickAdd } from '$lib/quick-add';
	import type { NewTask } from '$lib/tasks.svelte';

	let { onadd }: { onadd: (task: NewTask) => void } = $props();

	let value = $state('');
	let open = $state(false);
	let picked = $state(DEFAULT_PRIORITY);
	let input: HTMLInputElement;

	const parsed = $derived(value.trim() ? parseQuickAdd(value, todayInParis()) : null);
	// La syntaxe !1 à !4 l'emporte sur le sélecteur.
	const priority = $derived(parsed?.priority ?? picked);

	/** Appelé de façon synchrone dans le geste (bouton, raccourci) pour que le clavier mobile s'ouvre. */
	export function focus() {
		input.focus();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!parsed) return;
		onadd({ title: parsed.title, priority, dueDate: parsed.dueDate });
		value = '';
		picked = DEFAULT_PRIORITY;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		value = '';
		input.blur();
	}
</script>

<form class="quick-add" class:open onsubmit={submit}>
	<div class="row">
		<input
			bind:this={input}
			bind:value
			class="field"
			type="text"
			placeholder="Nouvelle tâche"
			aria-label="Nouvelle tâche"
			autocomplete="off"
			enterkeyhint="done"
			maxlength="500"
			disabled={network.offline}
			onfocus={() => (open = true)}
			onblur={() => (open = value !== '')}
			{onkeydown}
		/>
		<div class="priorities" role="group" aria-label="Urgence">
			{#each PRIORITIES as p (p)}
				<!-- pointerdown sans défaut : le champ garde le focus (sinon la surcouche mobile se ferme). -->
				<button
					class="priority"
					type="button"
					style:--c={PRIORITY_COLORS[p]}
					aria-pressed={priority === p}
					aria-label="Urgence {p} · {PRIORITY_LABELS[p]}"
					title={PRIORITY_LABELS[p]}
					disabled={network.offline}
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => (picked = p)}
				>
					{p}
				</button>
			{/each}
		</div>
	</div>
	{#if parsed && (parsed.priority || parsed.dueDate)}
		<p class="hint" aria-live="polite">
			{#if parsed.priority}Priorité {PRIORITY_LABELS[parsed.priority]}{/if}
			{#if parsed.priority && parsed.dueDate}·{/if}
			{#if parsed.dueDate}Échéance {formatDue(parsed.dueDate, todayInParis()).toLowerCase()}{/if}
		</p>
	{/if}
</form>

<button class="fab" class:hidden={open || network.offline} type="button" aria-label="Ajouter une tâche" onclick={focus}>
	<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
</button>

<style>
	.quick-add {
		margin: 4px 0 16px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.field {
		flex: 1 1 220px;
		min-height: 48px;
		font-size: 1rem;
	}

	.priorities {
		display: flex;
		gap: 4px;
	}

	.priority {
		width: 44px;
		min-height: 48px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--c);
		font-weight: 700;
		cursor: pointer;
	}

	.priority[aria-pressed='true'] {
		border-color: var(--c);
		background: color-mix(in srgb, var(--c) 15%, var(--surface));
	}

	@media (max-width: 640px) {
		.priorities {
			flex: 1 1 100%;
		}

		.priority {
			flex: 1;
		}
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
