import type { Task } from '$lib/server/repo/tasks';
import { addDays, dayOfWeek } from './dates';
import { PRIORITIES } from './priorities';
import { compareDefault } from './sort';
import { searchText, searchWords } from './text';

export const DUE_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export const KIND_FILTERS = ['single', 'recurring'] as const;
export const SORT_KEYS = ['default', 'priority', 'due', 'created', 'alpha'] as const;

export type DueFilter = (typeof DUE_FILTERS)[number];
export type KindFilter = (typeof KIND_FILTERS)[number];
export type SortKey = (typeof SORT_KEYS)[number];

export const DUE_LABELS: Record<DueFilter, string> = {
	overdue: 'En retard',
	today: "Aujourd'hui",
	week: 'Cette semaine',
	none: 'Sans date'
};

export const KIND_LABELS: Record<KindFilter, string> = {
	single: 'Ponctuelle',
	recurring: 'Récurrente'
};

export const SORT_LABELS: Record<SortKey, string> = {
	default: 'En retard, puis priorité',
	priority: 'Priorité',
	due: 'Échéance',
	created: 'Plus récentes',
	alpha: 'Alphabétique'
};

/** Dans une catégorie les valeurs se cumulent (OU) ; entre catégories elles se combinent (ET). Vide = tout. */
export type View = {
	priorities: number[];
	due: DueFilter[];
	kinds: KindFilter[];
	query: string;
	sort: SortKey;
};

export const DEFAULT_VIEW: View = { priorities: [], due: [], kinds: [], query: '', sort: 'default' };

export const QUERY_MAX = 200;

export function activeFilterCount(view: View) {
	return view.priorities.length + view.due.length + view.kinds.length;
}

function pick<T>(value: unknown, allowed: readonly T[]): T[] {
	if (!Array.isArray(value)) return [];
	return allowed.filter((v) => value.includes(v));
}

/** Vue lue depuis un cookie : tout ce qui n'est pas reconnu retombe sur les valeurs par défaut. */
export function sanitizeView(raw: unknown): View {
	if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_VIEW };
	const v = raw as Record<string, unknown>;
	return {
		priorities: pick(v.priorities, PRIORITIES),
		due: pick(v.due, DUE_FILTERS),
		kinds: pick(v.kinds, KIND_FILTERS),
		query: typeof v.query === 'string' ? v.query.slice(0, QUERY_MAX) : '',
		sort: SORT_KEYS.includes(v.sort as SortKey) ? (v.sort as SortKey) : 'default'
	};
}

/** Dimanche de la semaine en cours (semaine du lundi au dimanche). */
function endOfWeek(today: string) {
	return addDays(today, (7 - dayOfWeek(today)) % 7);
}

function matchesDue(dueDate: string | null, filter: DueFilter, today: string) {
	switch (filter) {
		case 'overdue':
			return dueDate !== null && dueDate < today;
		case 'today':
			return dueDate === today;
		case 'week':
			return dueDate !== null && dueDate >= today && dueDate <= endOfWeek(today);
		case 'none':
			return dueDate === null;
	}
}

type Filterable = Pick<Task, 'title' | 'notes' | 'priority' | 'dueDate' | 'createdAt' | 'recurrenceId'>;

const byDue = (a: Filterable, b: Filterable) => {
	if (a.dueDate === b.dueDate) return 0;
	if (a.dueDate === null) return 1;
	if (b.dueDate === null) return -1;
	return a.dueDate < b.dueDate ? -1 : 1;
};
const byPriority = (a: Filterable, b: Filterable) => a.priority - b.priority;
const byCreatedAsc = (a: Filterable, b: Filterable) => a.createdAt - b.createdAt;
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

function comparator(sort: SortKey, today: string) {
	switch (sort) {
		case 'default':
			return compareDefault(today);
		case 'priority':
			return (a: Filterable, b: Filterable) => byPriority(a, b) || byDue(a, b) || byCreatedAsc(a, b);
		case 'due':
			return (a: Filterable, b: Filterable) => byDue(a, b) || byPriority(a, b) || byCreatedAsc(a, b);
		case 'created':
			return (a: Filterable, b: Filterable) => b.createdAt - a.createdAt;
		case 'alpha':
			return (a: Filterable, b: Filterable) => collator.compare(a.title, b.title) || byCreatedAsc(a, b);
	}
}

export function applyView<T extends Filterable>(tasks: T[], view: View, today: string): T[] {
	const words = searchWords(view.query);
	return tasks
		.filter((task) => {
			if (view.priorities.length && !view.priorities.includes(task.priority)) return false;
			if (view.due.length && !view.due.some((f) => matchesDue(task.dueDate, f, today))) return false;
			if (view.kinds.length) {
				const kind: KindFilter = task.recurrenceId === null ? 'single' : 'recurring';
				if (!view.kinds.includes(kind)) return false;
			}
			if (words.length) {
				const text = searchText(task.title, task.notes);
				if (!words.every((w) => text.includes(w))) return false;
			}
			return true;
		})
		.sort(comparator(view.sort, today));
}
