<script lang="ts">
	import {
		activeFilterCount,
		DEFAULT_VIEW,
		DUE_FILTERS,
		DUE_LABELS,
		KIND_FILTERS,
		KIND_LABELS,
		QUERY_MAX,
		SORT_KEYS,
		SORT_LABELS,
		type View
	} from '$lib/filters';
	import { PRIORITIES, PRIORITY_LABELS } from '$lib/priorities';
	import PriorityBadge from './PriorityBadge.svelte';

	let { view = $bindable() }: { view: View } = $props();

	let open = $state(false);
	const count = $derived(activeFilterCount(view));

	function toggle<T>(list: T[], value: T) {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	function reset() {
		view = { ...DEFAULT_VIEW, query: view.query, sort: view.sort };
	}
</script>

<div class="bar">
	<input
		class="field search"
		type="search"
		placeholder="Rechercher"
		aria-label="Rechercher"
		maxlength={QUERY_MAX}
		bind:value={view.query}
	/>
	<button
		class="btn"
		class:active={count > 0}
		type="button"
		aria-expanded={open}
		aria-controls="filters"
		onclick={() => (open = !open)}
	>
		Filtres{#if count > 0}&nbsp;<span class="count">{count}</span>{/if}
	</button>
	<select class="field sort" aria-label="Trier" bind:value={view.sort}>
		{#each SORT_KEYS as key (key)}
			<option value={key}>{SORT_LABELS[key]}</option>
		{/each}
	</select>
</div>

{#if open}
	<div id="filters" class="panel">
		<fieldset>
			<legend>Priorité</legend>
			{#each PRIORITIES as p (p)}
				<button
					class="chip"
					type="button"
					aria-pressed={view.priorities.includes(p)}
					onclick={() => (view.priorities = toggle(view.priorities, p))}
				>
					<PriorityBadge priority={p} />
					{PRIORITY_LABELS[p]}
				</button>
			{/each}
		</fieldset>

		<fieldset>
			<legend>Échéance</legend>
			{#each DUE_FILTERS as f (f)}
				<button
					class="chip"
					type="button"
					aria-pressed={view.due.includes(f)}
					onclick={() => (view.due = toggle(view.due, f))}
				>
					{DUE_LABELS[f]}
				</button>
			{/each}
		</fieldset>

		<fieldset>
			<legend>Type</legend>
			{#each KIND_FILTERS as k (k)}
				<button
					class="chip"
					type="button"
					aria-pressed={view.kinds.includes(k)}
					onclick={() => (view.kinds = toggle(view.kinds, k))}
				>
					{KIND_LABELS[k]}
				</button>
			{/each}
		</fieldset>

		{#if count > 0}
			<button class="btn ghost reset" type="button" onclick={reset}>Réinitialiser les filtres</button>
		{/if}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 8px;
	}

	.search {
		flex: 1 1 200px;
	}

	.sort {
		flex: 0 1 auto;
		width: auto;
	}

	.btn.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.count {
		display: inline-grid;
		place-items: center;
		min-width: 1.4em;
		height: 1.4em;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-text);
		font-size: 0.8rem;
		font-weight: 700;
	}

	.panel {
		display: grid;
		gap: 12px;
		margin-bottom: 12px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: none;
	}

	legend {
		width: 100%;
		margin-bottom: 6px;
		padding: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 38px;
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, var(--surface-2));
	}

	.reset {
		justify-self: start;
	}
</style>
