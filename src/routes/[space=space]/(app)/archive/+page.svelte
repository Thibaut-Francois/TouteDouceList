<script lang="ts">
	import { goto } from '$app/navigation';
	import { ApiError, request } from '$lib/api';
	import { cursorParam, groupByDay, type ArchivePage } from '$lib/archive';
	import ArchiveDetail from '$lib/components/ArchiveDetail.svelte';
	import PriorityBadge from '$lib/components/PriorityBadge.svelte';
	import Toast, { type ToastMessage } from '$lib/components/Toast.svelte';
	import { formatDue, todayInParis } from '$lib/dates';
	import { QUERY_MAX } from '$lib/filters';
	import { network, OFFLINE_MESSAGE } from '$lib/network.svelte';
	import type { Task } from '$lib/server/repo/tasks';
	import { SPACE_NAMES } from '$lib/spaces';

	let { data } = $props();

	// Suivent les données du serveur (nouvelle recherche), et acceptent les ajouts et retraits locaux.
	let tasks = $derived(data.page.tasks);
	let next = $derived(data.page.next);
	let query = $derived(data.query);

	const today = todayInParis();
	const groups = $derived(groupByDay(tasks, today));

	let confirming = $state<string | null>(null);
	let loadingMore = $state(false);
	let toast = $state<ToastMessage | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

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
			if (e instanceof ApiError && e.status === 401) goto(`/${data.space}/unlock`);
			else showToast('Échec. Vérifie ta connexion.');
			return false;
		}
	}

	let detail = $state<Task | null>(null);

	// La recherche passe par l'URL : le serveur renvoie la première page correspondante.
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function search(value: string) {
		query = value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			const url = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '?';
			goto(url, { replaceState: true, keepFocus: true, noScroll: true });
		}, 250);
	}

	function loadMore() {
		if (!next || loadingMore) return;
		const params = new URLSearchParams({ q: data.query, after: cursorParam(next) });
		loadingMore = true;
		attempt(async () => {
			const page = await request<ArchivePage>('GET', `/api/${data.space}/archive?${params}`);
			tasks = [...tasks, ...page.tasks];
			next = page.next;
		}).finally(() => (loadingMore = false));
	}

	function reopen(task: Task) {
		return attempt(async () => {
			await request('PATCH', `/api/${data.space}/tasks/${task.id}`, { status: 'open' });
			tasks = tasks.filter((t) => t.id !== task.id);
			showToast(`« ${task.title} » est de retour dans Tâches.`);
		});
	}

	function remove(task: Task) {
		return attempt(async () => {
			await request('DELETE', `/api/${data.space}/tasks/${task.id}`);
			tasks = tasks.filter((t) => t.id !== task.id);
			confirming = null;
			showToast(`« ${task.title} » supprimée définitivement.`);
		});
	}
</script>

<svelte:head>
	<title>Archive · {SPACE_NAMES[data.space]} · TouteDouceList</title>
</svelte:head>

<h1>Archive</h1>

<input
	class="field search"
	type="search"
	placeholder="Rechercher dans l'archive"
	aria-label="Rechercher dans l'archive"
	maxlength={QUERY_MAX}
	disabled={network.offline}
	value={query}
	oninput={(e) => search(e.currentTarget.value)}
/>

{#if tasks.length === 0}
	<p class="empty muted">
		{data.query ? 'Aucune tâche terminée ne correspond.' : 'Aucune tâche terminée pour l’instant.'}
	</p>
{:else}
	{#each groups as group (group.day)}
		<section aria-labelledby="day-{group.day}">
			<h2 id="day-{group.day}">{group.label}</h2>
			<ul class="list">
				{#each group.tasks as task (task.id)}
					<li>
						<button class="body" type="button" aria-haspopup="dialog" onclick={() => (detail = task)}>
							<span class="title">{task.title}</span>
							<span class="meta">
								<PriorityBadge priority={task.priority} />
								{#if task.dueDate}<span>Échéance {formatDue(task.dueDate, today).toLowerCase()}</span>{/if}
								{#if task.recurrenceId}<span title="Récurrente" aria-label="Récurrente">↻</span>{/if}
							</span>
							{#if task.notes}<span class="notes">{task.notes}</span>{/if}
						</button>
						{#if confirming === task.id}
							<div class="confirm" role="group" aria-label="Confirmer la suppression">
								<span>Supprimer définitivement ?</span>
								<button class="btn ghost" type="button" onclick={() => (confirming = null)}>Annuler</button>
								<button class="btn danger" type="button" onclick={() => remove(task)}>Supprimer</button>
							</div>
						{:else}
							<div class="actions">
								<button class="btn" type="button" aria-label="Rouvrir « {task.title} »" onclick={() => reopen(task)}>
									Rouvrir
								</button>
								<button
									class="btn ghost danger-text"
									type="button"
									aria-label="Supprimer « {task.title} »"
									onclick={() => (confirming = task.id)}
								>
									Supprimer
								</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	{#if next}
		<button class="btn more" type="button" disabled={loadingMore} onclick={loadMore}>
			{loadingMore ? 'Chargement…' : 'Afficher plus'}
		</button>
	{/if}
{/if}

{#if detail}
	{@const task = detail}
	<ArchiveDetail
		{task}
		onreopen={() => reopen(task)}
		ondelete={() => remove(task)}
		onclose={() => (detail = null)}
	/>
{/if}

<Toast {toast} ondismiss={() => (toast = null)} />

<style>
	h1 {
		margin: 8px 0 12px;
		font-size: 1.3rem;
	}

	.search {
		margin-bottom: 8px;
	}

	.empty {
		margin: 32px 0;
		text-align: center;
	}

	h2 {
		margin: 20px 0 4px;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 600;
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
		gap: 6px 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}

	.body {
		display: grid;
		flex: 1 1 240px;
		gap: 2px;
		min-width: 0;
		min-height: var(--tap);
		padding: 0;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.title {
		color: var(--text-muted);
		text-decoration: line-through;
		text-decoration-color: color-mix(in srgb, var(--text-muted) 60%, transparent);
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

	.notes {
		overflow: hidden;
		color: var(--text-muted);
		font-size: 0.85rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions,
	.confirm {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.btn.danger {
		border-color: var(--danger);
		background: var(--danger);
		color: var(--accent-text);
		font-weight: 600;
	}

	.danger-text {
		color: var(--danger);
	}

	.more {
		display: block;
		margin: 16px auto 0;
	}
</style>
