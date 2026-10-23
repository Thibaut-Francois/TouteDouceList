import type { Task } from '$lib/server/repo/tasks';

type Sortable = Pick<Task, 'priority' | 'dueDate' | 'createdAt'>;

/** Tri par défaut : en retard d'abord, puis priorité, puis échéance (sans date en dernier). */
export function compareDefault(today: string) {
	return (a: Sortable, b: Sortable) => {
		const aLate = a.dueDate !== null && a.dueDate < today;
		const bLate = b.dueDate !== null && b.dueDate < today;
		if (aLate !== bLate) return aLate ? -1 : 1;
		if (a.priority !== b.priority) return a.priority - b.priority;
		if (a.dueDate !== b.dueDate) {
			if (a.dueDate === null) return 1;
			if (b.dueDate === null) return -1;
			return a.dueDate < b.dueDate ? -1 : 1;
		}
		return a.createdAt - b.createdAt;
	};
}
