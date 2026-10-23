<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { todayInParis } from '$lib/dates';
	import type { Task } from '$lib/server/repo/tasks';
	import type { SpaceId } from '$lib/spaces';
	import { TaskStore, type ViewTask } from '$lib/tasks.svelte';
	import QuickAdd from './QuickAdd.svelte';
	import TaskEditor from './TaskEditor.svelte';
	import TaskItem from './TaskItem.svelte';
	import Toast, { type ToastMessage } from './Toast.svelte';

	let { space, tasks }: { space: SpaceId; tasks: Task[] } = $props();

	// Composant recréé à chaque changement d'espace ({#key} dans la page) : l'espace initial suffit.
	const store = untrack(() => new TaskStore(space, tasks));

	// « Aujourd'hui » est recalculé à chaque rechargement (retour sur l'app) pour suivre minuit.
	let today = $state(todayInParis());
	$effect(() => {
		store.setServer(tasks);
		today = todayInParis();
	});

	let toast = $state<ToastMessage | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	function showToast(message: string, action?: ToastMessage['action']) {
		clearTimeout(toastTimer);
		toast = { message, action };
		toastTimer = setTimeout(() => (toast = null), 5000);
	}

	store.onError = (message) => showToast(message);
	store.onUnauthorized = () => goto(`/${space}/unlock`);

	function complete(task: ViewTask) {
		store.complete(task.id);
		showToast(`« ${task.title} » terminée`, {
			label: 'Annuler',
			run: () => store.reopen(task.id)
		});
	}

	let editing = $state<ViewTask | null>(null);
	let quickAdd: QuickAdd;

	function isEditable(target: EventTarget | null) {
		return (
			target instanceof HTMLElement &&
			(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
		);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'n' && event.key !== 'N') return;
		if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
		if (editing || isEditable(event.target)) return;
		event.preventDefault();
		quickAdd.focus();
	}
</script>

<svelte:window {onkeydown} />

<QuickAdd bind:this={quickAdd} onadd={(task) => store.add(task)} />

{#if store.open.length === 0}
	<p class="empty muted">Rien à faire pour l'instant.</p>
{:else}
	<ul class="tasks">
		{#each store.open as task (task.id)}
			<TaskItem
				{task}
				{today}
				oncomplete={() => complete(task)}
				onedit={() => (editing = task)}
				onretry={() => store.retry(task.id)}
			/>
		{/each}
	</ul>
{/if}

{#if editing}
	{@const task = editing}
	<TaskEditor {task} onsave={(patch) => store.update(task.id, patch)} onclose={() => (editing = null)} />
{/if}

<Toast {toast} ondismiss={() => (toast = null)} />

<style>
	.tasks {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.empty {
		margin: 32px 0;
		text-align: center;
	}
</style>
