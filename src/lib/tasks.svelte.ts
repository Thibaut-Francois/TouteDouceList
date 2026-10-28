import { SvelteMap } from 'svelte/reactivity';
import type { ListedTask, Task, TaskPatch } from '$lib/server/repo/tasks';
import type { Scope } from '$lib/spaces';
import { ApiError, request } from './api';
import { todayInParis } from './dates';
import { network, OFFLINE_MESSAGE } from './network.svelte';
import { compareDefault } from './sort';

export type ViewTask = ListedTask & { sync?: 'saving' | 'failed' };
export type NewTask = Pick<Task, 'title' | 'priority' | 'dueDate'>;

/**
 * Tâches d'un profil avec mises à jour optimistes : l'affichage combine la dernière liste
 * du serveur, les créations pas encore confirmées et les modifications en cours.
 * Les opérations d'une même tâche sont envoyées dans l'ordre (file par id).
 */
export class TaskStore {
	#server = $state<ListedTask[]>([]);
	#creates = new SvelteMap<string, ViewTask>();
	#patches = new SvelteMap<string, TaskPatch>();
	#versions = new Map<string, number>();
	#queues = new Map<string, Promise<void>>();

	onError: (message: string) => void = () => {};
	onUnauthorized: () => void = () => {};

	constructor(
		readonly scope: Scope,
		tasks: ListedTask[]
	) {
		this.#server = tasks;
	}

	#all = $derived.by(() =>
		[...this.#server, ...this.#creates.values()].map((task): ViewTask => {
			const patch = this.#patches.get(task.id);
			return patch ? { ...task, ...patch } : task;
		})
	);

	open = $derived.by(() =>
		this.#all.filter((t) => t.status === 'open').sort(compareDefault(todayInParis()))
	);

	/** Liste fraîche du serveur (rechargement) : les modifications en cours restent appliquées. */
	setServer(tasks: ListedTask[]) {
		this.#server = tasks;
		for (const task of tasks) this.#creates.delete(task.id);
	}

	/** Hors ligne, l'app est en lecture seule : aucune écriture n'est tentée. */
	#readOnly() {
		if (!network.offline) return false;
		this.onError(OFFLINE_MESSAGE);
		return true;
	}

	add(input: NewTask) {
		if (this.#readOnly()) return;
		const task: ViewTask = {
			...input,
			id: crypto.randomUUID(),
			...this.scope,
			notes: '',
			status: 'open',
			createdAt: Date.now(),
			completedAt: null,
			recurrenceId: null,
			occurrenceDate: null,
			stageId: null,
			sync: 'saving'
		};
		this.#creates.set(task.id, task);
		this.#saveCreate(task);
	}

	retry(id: string) {
		const task = this.#creates.get(id);
		if (!task || task.sync !== 'failed' || this.#readOnly()) return;
		this.#creates.set(id, { ...task, sync: 'saving' });
		this.#saveCreate(task);
	}

	update(id: string, patch: TaskPatch) {
		if (Object.keys(patch).length === 0 || this.#readOnly()) return;
		this.#patches.set(id, { ...this.#patches.get(id), ...patch });
		const version = (this.#versions.get(id) ?? 0) + 1;
		this.#versions.set(id, version);

		this.#enqueue(id, async () => {
			try {
				this.#upsertServer(await request<Task>('PATCH', this.#url(id), patch));
				if (this.#versions.get(id) === version) this.#patches.delete(id);
			} catch (e) {
				if (this.#isUnauthorized(e)) return;
				this.#patches.delete(id);
				this.onError('Modification non enregistrée. Vérifie ta connexion.');
			}
		});
	}

	complete(id: string) {
		this.update(id, { status: 'done' });
	}

	reopen(id: string) {
		this.update(id, { status: 'open' });
	}

	#saveCreate({ id, title, notes, priority, dueDate }: ViewTask) {
		this.#enqueue(id, async () => {
			try {
				const saved = await request<Task>('POST', this.#url(), { id, title, notes, priority, dueDate });
				this.#creates.delete(id);
				this.#upsertServer(saved);
			} catch (e) {
				if (this.#isUnauthorized(e)) return;
				const task = this.#creates.get(id);
				if (task) this.#creates.set(id, { ...task, sync: 'failed' });
			}
		});
	}

	#enqueue(id: string, op: () => Promise<void>) {
		const next = (this.#queues.get(id) ?? Promise.resolve()).then(op);
		this.#queues.set(id, next);
	}

	/** La réponse d'une écriture n'a pas le chantier ni l'étape : on garde ceux de la liste. */
	#upsertServer(task: Task) {
		const index = this.#server.findIndex((t) => t.id === task.id);
		if (index === -1) this.#server.push(task);
		else this.#server[index] = { ...this.#server[index], ...task };
	}

	#isUnauthorized(e: unknown) {
		if (!(e instanceof ApiError) || e.status !== 401) return false;
		this.onUnauthorized();
		return true;
	}

	#url(id?: string) {
		return id ? `/api/${this.scope.profileId}/tasks/${id}` : `/api/${this.scope.profileId}/tasks`;
	}
}
