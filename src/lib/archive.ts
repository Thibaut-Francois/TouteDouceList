import type { ArchiveCursor, Task } from '$lib/server/repo/tasks';
import { formatDue, todayInParis } from './dates';

export type ArchivePage = { tasks: Task[]; next: ArchiveCursor | null };

export const cursorParam = (cursor: ArchiveCursor) => `${cursor.completedAt}:${cursor.id}`;

/** Regroupe les tâches (déjà triées) par jour de complétion, à l'heure de Paris. */
export function groupByDay(tasks: Task[], today: string) {
	const groups: { day: string; label: string; tasks: Task[] }[] = [];
	for (const task of tasks) {
		const day = todayInParis(new Date(task.completedAt ?? 0));
		const last = groups.at(-1);
		if (last?.day === day) last.tasks.push(task);
		else groups.push({ day, label: formatDue(day, today), tasks: [task] });
	}
	return groups;
}
