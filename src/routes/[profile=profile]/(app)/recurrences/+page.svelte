<script lang="ts">
	import { goto } from '$app/navigation';
	import { ApiError, request } from '$lib/api';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import RecurrenceEditor from '$lib/components/RecurrenceEditor.svelte';
	import { network, OFFLINE_MESSAGE } from '$lib/network.svelte';
	import Toast, { type ToastMessage } from '$lib/components/Toast.svelte';
	import { describePreset } from '$lib/recurrence/presets';
	import type { Recurrence, RecurrenceInput } from '$lib/server/repo/recurrences';
	import { PROFILE_NAMES } from '$lib/spaces';

	let { data } = $props();

	// Suit les données du serveur, et accepte les mises à jour locales après chaque appel.
	let recurrences = $derived(data.recurrences);
	let editing = $state<{ recurrence: Recurrence | null } | null>(null);
	let toast = $state<ToastMessage | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const base = $derived(`/api/${data.profile}/recurrences`);

	function showToast(message: string) {
		clearTimeout(toastTimer);
		toast = { message };
		toastTimer = setTimeout(() => (toast = null), 5000);
	}

	/** Exécute un appel d'API ; en cas d'échec, affiche l'erreur et renvoie false. */
	async function attempt(run: () => Promise<unknown>) {
		if (network.offline) {
			showToast(OFFLINE_MESSAGE);
			return false;
		}
		try {
			await run();
			return true;
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				goto(`/${data.profile}/unlock`);
				return false;
			}
			showToast(
				e instanceof ApiError && e.status === 400
					? e.message
					: 'Échec de l’enregistrement. Vérifie ta connexion.'
			);
			return false;
		}
	}

	function replace(updated: Recurrence) {
		recurrences = recurrences.map((r) => (r.id === updated.id ? updated : r));
	}

	async function save(input: RecurrenceInput) {
		const current = editing?.recurrence;
		return attempt(async () => {
			if (current) {
				replace(await request<Recurrence>('PATCH', `${base}/${current.id}`, input));
				return;
			}
			const created = await request<Recurrence>('POST', base, input);
			recurrences = [...recurrences, created].sort((a, b) =>
				a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
			);
			showToast(`« ${created.title} » créée. Ses occurrences apparaîtront dans Tâches à leur date.`);
		});
	}

	async function remove(keepOpen: boolean) {
		const current = editing?.recurrence;
		if (!current) return false;
		return attempt(async () => {
			await request('DELETE', `${base}/${current.id}${keepOpen ? '?occurrences=keep' : ''}`);
			recurrences = recurrences.filter((r) => r.id !== current.id);
			showToast(`« ${current.title} » supprimée.`);
		});
	}

	function toggleActive(recurrence: Recurrence) {
		attempt(async () =>
			replace(
				await request<Recurrence>('PATCH', `${base}/${recurrence.id}`, { active: !recurrence.active })
			)
		);
	}
</script>

<svelte:head>
	<title>Récurrences · {PROFILE_NAMES[data.profile]} · TouteDouceList</title>
</svelte:head>

<div class="head">
	<h1>Récurrences</h1>
	<button
		class="btn primary"
		type="button"
		disabled={network.offline}
		onclick={() => (editing = { recurrence: null })}
	>
		Nouvelle récurrence
	</button>
</div>

{#if recurrences.length === 0}
	<p class="empty muted">
		Aucune récurrence. Une récurrence crée automatiquement une tâche à chaque date prévue
		(« chaque mardi », « le 1er du mois »…).
	</p>
{:else}
	<ul class="list">
		{#each recurrences as recurrence (recurrence.id)}
			<li class:paused={!recurrence.active}>
				<button class="body" type="button" onclick={() => (editing = { recurrence })}>
					<span class="title">{recurrence.title}</span>
					<span class="meta">
						<PriorityBadge priority={recurrence.priority} />
						<span>{describePreset(recurrence.preset)}</span>
						{#if !recurrence.active}<span class="tag">En pause</span>{/if}
					</span>
				</button>
				<button
					class="btn ghost"
					type="button"
					disabled={network.offline}
					onclick={() => toggleActive(recurrence)}
				>
					{recurrence.active ? 'Mettre en pause' : 'Reprendre'}
				</button>
			</li>
		{/each}
	</ul>
{/if}

{#if editing}
	<RecurrenceEditor
		profile={data.profile}
		recurrence={editing.recurrence}
		onsave={save}
		ondelete={remove}
		onclose={() => (editing = null)}
	/>
{/if}

<Toast {toast} ondismiss={() => (toast = null)} />

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 8px 0 12px;
	}

	h1 {
		margin: 0;
		font-size: 1.3rem;
	}

	.empty {
		margin: 32px 0;
		text-align: center;
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}

	li.paused .title {
		color: var(--text-muted);
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
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.tag {
		padding: 1px 8px;
		border: 1px solid var(--border);
		border-radius: 999px;
	}
</style>
