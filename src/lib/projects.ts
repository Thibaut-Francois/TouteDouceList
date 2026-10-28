// Règles des chantiers, partagées entre serveur et interface (sans dépendance).
// Dates : 'YYYY-MM-DD' flottantes, comparables comme du texte.

export type StageStatus = 'upcoming' | 'current' | 'late' | 'done';

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
	upcoming: 'À venir',
	current: 'En cours',
	late: 'En retard',
	done: 'Terminée'
};

export type StageDates = { startDate: string; endDate: string };
export type TaskCounts = { total: number; done: number };

/**
 * Statut d'une étape, dans cet ordre : terminée (au moins une tâche, toutes faites ; ou aucune tâche
 * et date de fin passée), en retard (fin passée, tâches ouvertes), à venir (début futur), en cours.
 */
export function stageStatus(stage: StageDates, counts: TaskCounts, today: string): StageStatus {
	const open = counts.total - counts.done;
	if (counts.total > 0 && open === 0) return 'done';
	if (stage.endDate < today) return open > 0 ? 'late' : 'done';
	if (stage.startDate > today) return 'upcoming';
	return 'current';
}

/** Étape en cours d'un chantier : la première, dans l'ordre, qui n'est pas terminée. */
export function currentStage<T extends StageDates & { counts: TaskCounts }>(stages: T[], today: string) {
	return stages.find((s) => stageStatus(s, s.counts, today) !== 'done');
}

export function progress(counts: TaskCounts[]): TaskCounts {
	return counts.reduce((sum, c) => ({ total: sum.total + c.total, done: sum.done + c.done }), {
		total: 0,
		done: 0
	});
}

/** Dates d'un chantier : du plus tôt des débuts au plus tard des fins (les étapes peuvent se chevaucher). */
export function projectDates(stages: StageDates[]): StageDates | null {
	if (stages.length === 0) return null;
	return {
		startDate: stages.reduce((min, s) => (s.startDate < min ? s.startDate : min), stages[0].startDate),
		endDate: stages.reduce((max, s) => (s.endDate > max ? s.endDate : max), stages[0].endDate)
	};
}

/** Échéance en dehors des dates de l'étape : autorisée, mais signalée. */
export function isOutsideStage(dueDate: string | null, stage: StageDates) {
	return dueDate !== null && (dueDate < stage.startDate || dueDate > stage.endDate);
}

/** Nouvel ordre après avoir déplacé l'élément d'indice from à l'indice to. */
export function move<T>(items: readonly T[], from: number, to: number): T[] {
	const result = [...items];
	if (from < 0 || from >= items.length || to < 0 || to >= items.length) return result;
	const [item] = result.splice(from, 1);
	result.splice(to, 0, item);
	return result;
}
