<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto, invalidateAll } from '$app/navigation';
	import { ApiError, request } from '$lib/api';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import ProjectEditor from '$lib/components/ProjectEditor.svelte';
	import ProjectTaskRow from '$lib/components/ProjectTaskRow.svelte';
	import StageEditor from '$lib/components/StageEditor.svelte';
	import TaskEditor from '$lib/components/TaskEditor.svelte';
	import Toast, { type ToastMessage } from '$lib/components/Toast.svelte';
	import { formatDateTitle, formatInstant, formatTaskDate } from '$lib/dates';
	import { network, OFFLINE_MESSAGE } from '$lib/network.svelte';
	import { PRIORITY_LABELS } from '$lib/priorities';
	import {
		currentStage,
		move,
		progress,
		projectDates,
		stageStatus,
		STAGE_STATUS_LABELS,
		type TaskCounts
	} from '$lib/projects';
	import { parseQuickAdd } from '$lib/quick-add';
	import type {
		ProjectDetail,
		ProjectInput,
		Stage,
		StageDeletion,
		StageDetail,
		StageInput
	} from '$lib/server/repo/projects';
	import type { Task, TaskWrite } from '$lib/server/repo/tasks';
	import { PROFILE_NAMES, profilesOf, type ProfileId } from '$lib/spaces';
	import { today } from '$lib/today.svelte';

	let { data } = $props();

	// Suit le serveur (rechargé après chaque écriture) et accepte les changements optimistes.
	let project = $derived(data.project);
	const base = $derived(`/api/${data.profile}/projects/${data.project.id}`);

	// Pro : tâches attribuées à Thibaut ou Philippe ; Perso : un seul profil, rien à choisir.
	const people = $derived(profilesOf(data.space));
	const shared = $derived(people.length > 1);
	const assigneeOptions = $derived(people.map((p) => ({ id: p, label: PROFILE_NAMES[p] })));
	// @t, @p : première lettre du nom de chaque profil.
	const shortcuts = $derived(
		shared ? Object.fromEntries(people.map((p) => [PROFILE_NAMES[p][0].toLowerCase(), p])) : {}
	);
	const defaultAssignee = $derived<ProfileId>(people.includes(data.profile) ? data.profile : people[0]);

	let filter = $state<'all' | ProfileId>('all');
	const readOnly = $derived(project.status === 'done' || network.offline);

	const countsOf = (stage: StageDetail): TaskCounts => ({
		total: stage.tasks.length,
		done: stage.tasks.filter((t) => t.status === 'done').length
	});
	const stages = $derived(project.stages.map((s) => ({ ...s, counts: countsOf(s) })));
	const overall = $derived(progress(stages.map((s) => s.counts)));
	const dates = $derived(projectDates(stages));
	const current = $derived(currentStage(stages, today.value));
	const allDone = $derived(stages.length > 0 && !current && overall.total > 0);

	// L'étape en cours est dépliée à l'ouverture.
	const expanded = new SvelteSet<string>(untrack(() => (current ? [current.id] : [])));

	let toast = $state<ToastMessage | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	function showToast(message: string) {
		clearTimeout(toastTimer);
		toast = { message };
		toastTimer = setTimeout(() => (toast = null), 5000);
	}

	/** Appel d'API, puis rechargement depuis le serveur (succès comme échec : l'écran redevient exact). */
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
				e instanceof ApiError && e.status >= 400 && e.status < 500
					? e.message
					: 'Échec de l’enregistrement. Vérifie ta connexion.'
			);
			return false;
		} finally {
			await invalidateAll();
		}
	}

	function patchLocal(change: (p: ProjectDetail) => ProjectDetail) {
		project = change(project);
	}

	function updateTaskLocal(taskId: string, change: (t: Task) => Task) {
		patchLocal((p) => ({
			...p,
			stages: p.stages.map((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === taskId ? change(t) : t)) }))
		}));
	}

	// --- Chantier ---

	let editingProject = $state(false);
	let confirmingFinish = $state(false);
	let confirmingDelete = $state(false);

	const saveProject = (input: ProjectInput) => attempt(() => request('PATCH', base, input));

	async function setStatus(status: 'open' | 'done') {
		confirmingFinish = false;
		if (await attempt(() => request('PATCH', base, { status }))) {
			showToast(status === 'done' ? `« ${project.name} » est terminé : il est dans l’archive.` : `« ${project.name} » est restauré.`);
		}
	}

	async function deleteProject() {
		if (network.offline) return showToast(OFFLINE_MESSAGE);
		try {
			await request('DELETE', base);
			await goto(`/${data.profile}/archive`);
		} catch {
			showToast('Échec de la suppression. Vérifie ta connexion.');
		}
	}

	// --- Étapes ---

	let editingStage = $state<{ stage: Stage | null } | null>(null);

	function saveStage(input: StageInput) {
		const stage = editingStage?.stage;
		return attempt(async () => {
			if (stage) await request('PATCH', `${base}/stages/${stage.id}`, input);
			else expanded.add((await request<Stage>('POST', `${base}/stages`, input)).id);
		});
	}

	function deleteStage(choice: StageDeletion) {
		const stage = editingStage?.stage;
		if (!stage) return Promise.resolve(false);
		const query =
			'moveTo' in choice ? `?moveTo=${choice.moveTo}` : 'deleteOpen' in choice ? '?tasks=delete' : '';
		return attempt(() => request('DELETE', `${base}/stages/${stage.id}${query}`));
	}

	function reorder(from: number, to: number) {
		if (from === to || to < 0 || to >= project.stages.length) return;
		const ordered = move(project.stages, from, to);
		patchLocal((p) => ({ ...p, stages: ordered }));
		attempt(() => request('PUT', `${base}/stages/order`, { ids: ordered.map((s) => s.id) }));
	}

	// Glisser-déposer (souris) ; les boutons ↑ ↓ font la même chose au doigt et au clavier.
	let dragged = $state<number | null>(null);
	let over = $state<number | null>(null);

	function drop(index: number) {
		if (dragged !== null) reorder(dragged, index);
		dragged = over = null;
	}

	// --- Tâches ---

	let editingTask = $state<Task | null>(null);
	const drafts = $state<Record<string, string>>({});

	function toggle(task: Task) {
		const status = task.status === 'done' ? 'open' : 'done';
		updateTaskLocal(task.id, (t) => ({ ...t, status }));
		attempt(() => request('PATCH', `${base}/tasks/${task.id}`, { status }));
	}

	function saveTask(task: Task, patch: TaskWrite) {
		if (Object.keys(patch).length === 0) return;
		updateTaskLocal(task.id, (t) => ({ ...t, ...patch }));
		attempt(() => request('PATCH', `${base}/tasks/${task.id}`, patch));
	}

	const parse = (text: string) => parseQuickAdd(text, today.value, { assignees: shortcuts });

	function addTask(event: SubmitEvent, stage: StageDetail) {
		event.preventDefault();
		const text = drafts[stage.id]?.trim();
		if (!text) return;
		if (network.offline) return showToast(OFFLINE_MESSAGE);
		const parsed = parse(text);
		const body = {
			id: crypto.randomUUID(),
			title: parsed.title,
			priority: parsed.priority ?? 3,
			dueDate: parsed.dueDate,
			stageId: stage.id,
			profileId: parsed.assignee ?? defaultAssignee
		};
		drafts[stage.id] = '';
		const optimistic: Task = {
			...body,
			notes: '',
			spaceId: data.space,
			status: 'open',
			createdAt: Date.now(),
			completedAt: null,
			recurrenceId: null,
			occurrenceDate: null
		};
		patchLocal((p) => ({
			...p,
			stages: p.stages.map((s) => (s.id === stage.id ? { ...s, tasks: [...s.tasks, optimistic] } : s))
		}));
		attempt(() => request('POST', `${base}/tasks`, body));
	}

	function preview(text: string | undefined) {
		if (!text?.trim()) return '';
		const p = parse(text);
		return [
			p.priority && `Priorité ${PRIORITY_LABELS[p.priority]}`,
			p.dueDate && `Échéance ${formatTaskDate(p.dueDate, today.value)}`,
			shared && `Pour ${PROFILE_NAMES[p.assignee ?? defaultAssignee]}`
		]
			.filter(Boolean)
			.join(' · ');
	}

	const visibleTasks = (stage: StageDetail) =>
		filter === 'all' ? stage.tasks : stage.tasks.filter((t) => t.profileId === filter);
</script>

<svelte:head>
	<title>{project.name} · Chantiers · TouteDouceList</title>
</svelte:head>

<a class="back" href="/{data.profile}/chantiers">← Chantiers</a>

<header class="project">
	<div class="title-row">
		<h1>{project.name}</h1>
		{#if project.status === 'open'}
			<button class="btn ghost" type="button" disabled={readOnly} onclick={() => (editingProject = true)}>
				Modifier
			</button>
		{/if}
	</div>
	{#if project.description}<p class="description">{project.description}</p>{/if}
	{#if dates}
		<p class="meta">
			<span title={formatDateTitle(dates.startDate)}>{formatTaskDate(dates.startDate, today.value, { capitalize: true })}</span>
			→
			<span title={formatDateTitle(dates.endDate)}>{formatTaskDate(dates.endDate, today.value)}</span>
		</p>
	{/if}
	<ProgressBar counts={overall} label="Avancement du chantier" />

	{#if project.status === 'done'}
		<div class="banner" role="status">
			<span>
				Chantier terminé{project.completedAt ? ` le ${formatInstant(project.completedAt)}` : ''}, consultable en lecture seule.
			</span>
			<div class="banner-actions">
				<button class="btn" type="button" disabled={network.offline} onclick={() => setStatus('open')}>Restaurer</button>
				{#if confirmingDelete}
					<span>Supprimer le chantier, ses étapes et toutes leurs tâches ?</span>
					<button class="btn ghost" type="button" onclick={() => (confirmingDelete = false)}>Annuler</button>
					<button class="btn danger" type="button" disabled={network.offline} onclick={deleteProject}>
						Supprimer définitivement
					</button>
				{:else}
					<button class="btn ghost danger-text" type="button" onclick={() => (confirmingDelete = true)}>
						Supprimer…
					</button>
				{/if}
			</div>
		</div>
	{:else if allDone}
		<div class="banner success" role="status">
			<span>Tout est fait.</span>
			<button class="btn primary" type="button" disabled={readOnly} onclick={() => setStatus('done')}>
				Marquer terminé
			</button>
		</div>
	{/if}
</header>

<div class="toolbar">
	{#if shared}
		<div class="filter" role="group" aria-label="Tâches affichées">
			{#each [{ id: 'all', label: 'Toutes' }, ...assigneeOptions] as option (option.id)}
				<button
					type="button"
					aria-pressed={filter === option.id}
					onclick={() => (filter = option.id as typeof filter)}>{option.label}</button
				>
			{/each}
		</div>
	{/if}
	{#if project.status === 'open'}
		<button class="btn" type="button" disabled={readOnly} onclick={() => (editingStage = { stage: null })}>
			Ajouter une étape
		</button>
	{/if}
</div>

{#if stages.length === 0}
	<p class="empty muted">Aucune étape. Ajoutez la première pour y ranger des tâches.</p>
{:else}
	<ol class="timeline" aria-label="Étapes">
		{#each stages as stage, index (stage.id)}
			{@const status = stageStatus(stage, stage.counts, today.value)}
			{@const open = expanded.has(stage.id)}
			{@const tasks = visibleTasks(stage)}
			<li
				class="stage {status}"
				class:over={over === index && dragged !== index}
				draggable={!readOnly}
				ondragstart={(e) => {
					dragged = index;
					e.dataTransfer?.setData('text/plain', stage.id);
				}}
				ondragover={(e) => {
					if (dragged === null) return;
					e.preventDefault();
					over = index;
				}}
				ondragleave={() => over === index && (over = null)}
				ondrop={(e) => {
					e.preventDefault();
					drop(index);
				}}
				ondragend={() => (dragged = over = null)}
			>
				<span class="marker" aria-hidden="true"></span>
				<div class="stage-head">
					<button
						class="toggle"
						type="button"
						aria-expanded={open}
						aria-controls="stage-{stage.id}"
						onclick={() => (open ? expanded.delete(stage.id) : expanded.add(stage.id))}
					>
						<span class="stage-name">{stage.name}</span>
						<span class="meta">
							<span class="status {status}">{STAGE_STATUS_LABELS[status]}</span>
							<span title="{formatDateTitle(stage.startDate)} → {formatDateTitle(stage.endDate)}">
								{formatTaskDate(stage.startDate, today.value, { capitalize: true })} → {formatTaskDate(stage.endDate, today.value)}
							</span>
							{#if !open}<span>{stage.counts.done}/{stage.counts.total}</span>{/if}
						</span>
					</button>
					{#if project.status === 'open'}
						<div class="stage-actions">
							<button
								class="btn ghost icon"
								type="button"
								aria-label="Monter « {stage.name} »"
								disabled={readOnly || index === 0}
								onclick={() => reorder(index, index - 1)}>↑</button
							>
							<button
								class="btn ghost icon"
								type="button"
								aria-label="Descendre « {stage.name} »"
								disabled={readOnly || index === stages.length - 1}
								onclick={() => reorder(index, index + 1)}>↓</button
							>
							<button
								class="btn ghost icon"
								type="button"
								aria-label="Modifier l’étape « {stage.name} »"
								disabled={readOnly}
								onclick={() => (editingStage = { stage })}>✎</button
							>
						</div>
					{/if}
				</div>

				{#if open}
					<div class="stage-body" id="stage-{stage.id}">
						<ProgressBar counts={stage.counts} label="Avancement de « {stage.name} »" />
						{#if tasks.length}
							<ul class="tasks">
								{#each tasks as task (task.id)}
									<ProjectTaskRow
										{task}
										{stage}
										today={today.value}
										showAssignee={shared}
										disabled={readOnly}
										ontoggle={() => toggle(task)}
										onedit={() => (editingTask = task)}
									/>
								{/each}
							</ul>
						{:else}
							<p class="muted none">{stage.tasks.length ? 'Aucune tâche pour ce filtre.' : 'Aucune tâche.'}</p>
						{/if}
						{#if project.status === 'open'}
							<form class="add" onsubmit={(e) => addTask(e, stage)}>
								<input
									class="field"
									type="text"
									bind:value={drafts[stage.id]}
									placeholder={shared ? 'Nouvelle tâche (@t, @p, !1, demain…)' : 'Nouvelle tâche (!1, demain…)'}
									aria-label="Nouvelle tâche dans « {stage.name} »"
									maxlength="500"
									enterkeyhint="done"
									autocomplete="off"
									disabled={readOnly}
								/>
								{#if drafts[stage.id]?.trim()}
									<p class="preview muted">{preview(drafts[stage.id])}</p>
								{/if}
							</form>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/if}

{#if project.status === 'open' && !allDone && stages.length}
	<div class="finish">
		{#if confirmingFinish}
			<span>{overall.total - overall.done} tâche(s) ouverte(s) resteront dans les listes. Terminer quand même ?</span>
			<button class="btn ghost" type="button" onclick={() => (confirmingFinish = false)}>Annuler</button>
			<button class="btn" type="button" disabled={readOnly} onclick={() => setStatus('done')}>Terminer</button>
		{:else}
			<button class="btn ghost" type="button" disabled={readOnly} onclick={() => (confirmingFinish = true)}>
				Terminer le chantier…
			</button>
		{/if}
	</div>
{/if}

{#if editingProject}
	<ProjectEditor project={project} onsave={saveProject} onclose={() => (editingProject = false)} />
{/if}

{#if editingStage}
	{@const stage = editingStage.stage}
	<StageEditor
		{stage}
		otherStages={project.stages.filter((s) => s.id !== stage?.id)}
		openCount={stage ? (project.stages.find((s) => s.id === stage.id)?.tasks.filter((t) => t.status === 'open').length ?? 0) : 0}
		onsave={saveStage}
		ondelete={stage ? deleteStage : undefined}
		onclose={() => (editingStage = null)}
	/>
{/if}

{#if editingTask}
	{@const task = editingTask}
	<TaskEditor
		{task}
		assignees={shared ? assigneeOptions : []}
		stages={project.stages.map((s) => ({ id: s.id, label: s.name }))}
		onsave={(patch) => saveTask(task, patch)}
		onclose={() => (editingTask = null)}
	/>
{/if}

<Toast {toast} ondismiss={() => (toast = null)} />

<style>
	.back {
		display: inline-block;
		margin: 10px 0 4px;
		text-decoration: none;
	}

	.project {
		display: grid;
		gap: 8px;
		margin-bottom: 12px;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h1 {
		margin: 0;
		font-size: 1.3rem;
		overflow-wrap: anywhere;
	}

	.description {
		margin: 0;
		white-space: pre-wrap;
		color: var(--text-muted);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}

	.banner.success {
		border-color: var(--success);
	}

	.banner-actions {
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

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 12px;
	}

	.filter {
		display: flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.filter button {
		min-height: 38px;
		padding: 0 12px;
		border: none;
		border-radius: 7px;
		background: none;
		color: var(--text-muted);
		font-weight: 600;
		cursor: pointer;
	}

	.filter button[aria-pressed='true'] {
		background: var(--surface-2);
		color: var(--text);
	}

	.empty {
		margin: 32px 0;
		text-align: center;
	}

	/* Frise verticale : un trait à gauche, un repère par étape, coloré selon son statut. */
	.timeline {
		margin: 0;
		padding: 0 0 0 18px;
		border-left: 2px solid var(--border);
		list-style: none;
	}

	.stage {
		position: relative;
		margin-bottom: 10px;
		padding: 2px 0 2px 10px;
		border-radius: var(--radius);
	}

	.stage.over {
		outline: 2px dashed var(--accent);
	}

	.marker {
		position: absolute;
		top: 16px;
		left: -26px;
		width: 14px;
		height: 14px;
		border: 2px solid var(--text-muted);
		border-radius: 50%;
		background: var(--bg);
	}

	.stage.current .marker {
		border-color: var(--accent);
		background: var(--accent);
	}

	.stage.late .marker {
		border-color: var(--danger);
		background: var(--danger);
	}

	.stage.done .marker {
		border-color: var(--success);
		background: var(--success);
	}

	.stage-head {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.toggle {
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

	.stage-name {
		font-weight: 600;
		overflow-wrap: anywhere;
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

	.stage-actions {
		display: flex;
		flex: none;
	}

	.icon {
		min-width: var(--tap);
		padding: 0;
	}

	.stage-body {
		display: grid;
		gap: 8px;
		padding: 0 0 6px;
	}

	.tasks {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.none {
		margin: 0;
		font-size: 0.9rem;
	}

	.add {
		display: grid;
		gap: 4px;
	}

	.preview {
		margin: 0;
		font-size: 0.85rem;
	}

	.finish {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 16px;
		color: var(--text-muted);
	}
</style>
