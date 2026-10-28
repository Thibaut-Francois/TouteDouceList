<script lang="ts">
	import { goto } from '$app/navigation';
	import { ApiError, request } from '$lib/api';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import ProjectEditor from '$lib/components/ProjectEditor.svelte';
	import Toast, { type ToastMessage } from '$lib/components/Toast.svelte';
	import { formatDateTitle, formatTaskDate } from '$lib/dates';
	import { network, OFFLINE_MESSAGE } from '$lib/network.svelte';
	import { currentStage, progress, projectDates, stageStatus, STAGE_STATUS_LABELS } from '$lib/projects';
	import type { ProjectDetail, ProjectInput } from '$lib/server/repo/projects';
	import { PROFILE_NAMES } from '$lib/spaces';
	import { today } from '$lib/today.svelte';

	let { data } = $props();

	let creating = $state(false);
	let toast = $state<ToastMessage | null>(null);

	const cards = $derived(
		data.projects.map((project) => {
			const current = currentStage(project.stages, today.value);
			return {
				project,
				current,
				status: current && stageStatus(current, current.counts, today.value),
				dates: projectDates(project.stages),
				counts: progress(project.stages.map((s) => s.counts))
			};
		})
	);

	async function create(input: ProjectInput) {
		if (network.offline) {
			toast = { message: OFFLINE_MESSAGE };
			return false;
		}
		try {
			const project = await request<ProjectDetail>('POST', `/api/${data.profile}/projects`, input);
			await goto(`/${data.profile}/chantiers/${project.id}`);
			return true;
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) goto(`/${data.profile}/unlock`);
			else toast = { message: 'Échec de l’enregistrement. Vérifie ta connexion.' };
			return false;
		}
	}
</script>

<svelte:head>
	<title>Chantiers · {PROFILE_NAMES[data.profile]} · TouteDouceList</title>
</svelte:head>

<div class="head">
	<h1>Chantiers</h1>
	<button class="btn primary" type="button" disabled={network.offline} onclick={() => (creating = true)}>
		Nouveau chantier
	</button>
</div>

{#if cards.length === 0}
	<p class="empty muted">
		Aucun chantier en cours. Un chantier se découpe en étapes datées, chacune avec ses tâches.
	</p>
{:else}
	<ul class="cards">
		{#each cards as { project, current, status, dates, counts } (project.id)}
			<li>
				<a class="card" href="/{data.profile}/chantiers/{project.id}">
					<span class="name">{project.name}</span>
					<span class="meta">
						{#if current && status}
							<span>Étape : {current.name}</span>
							<span class="status {status}">{STAGE_STATUS_LABELS[status]}</span>
						{:else if project.stages.length}
							<span class="status done">Tout est fait</span>
						{:else}
							<span>Aucune étape</span>
						{/if}
					</span>
					{#if dates}
						<span class="meta">
							<span title={formatDateTitle(dates.startDate)}>{formatTaskDate(dates.startDate, today.value, { capitalize: true })}</span>
							→
							<span title={formatDateTitle(dates.endDate)}>{formatTaskDate(dates.endDate, today.value)}</span>
						</span>
					{/if}
					<ProgressBar {counts} label="Avancement de « {project.name} »" />
				</a>
			</li>
		{/each}
	</ul>
{/if}

{#if creating}
	<ProjectEditor onsave={create} onclose={() => (creating = false)} />
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

	.cards {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: grid;
		gap: 6px;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		text-decoration: none;
	}

	.card:hover {
		border-color: var(--accent);
	}

	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.status {
		padding: 0 8px;
		border: 1px solid currentColor;
		border-radius: 999px;
	}

	.status.current {
		color: var(--accent);
	}

	.status.late {
		color: var(--danger);
	}

	.status.done {
		color: var(--success);
	}
</style>
