import { addDays, dayOfWeek } from './dates';

// Syntaxe optionnelle du champ de création : !1 à !4, auj / aujourd'hui, demain, lundi … dimanche,
// et dans un chantier de Pro, @t / @p.

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const normalize = (word: string) =>
	word
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[’`]/g, "'");

function dateFor(word: string, today: string) {
	if (word === 'auj' || word === "aujourd'hui") return today;
	if (word === 'demain') return addDays(today, 1);
	const target = WEEKDAYS.indexOf(word);
	if (target === -1) return null;
	// Le prochain jour de ce nom, strictement après aujourd'hui.
	return addDays(today, (target - dayOfWeek(today) + 7) % 7 || 7);
}

export type QuickAdd<A extends string = string> = {
	title: string;
	priority: number | null;
	dueDate: string | null;
	assignee: A | null;
};

/**
 * assignees : dans un chantier de Pro, « @t » / « @p » attribuent la tâche (lettre → profil).
 * Sans cette option, « @t » reste un mot du titre.
 */
export function parseQuickAdd<A extends string = string>(
	input: string,
	today: string,
	{ assignees = {} }: { assignees?: Record<string, A> } = {}
): QuickAdd<A> {
	let priority: number | null = null;
	let dueDate: string | null = null;
	let assignee: A | null = null;
	const kept: string[] = [];

	for (const word of input.trim().split(/\s+/)) {
		const normalized = normalize(word);
		const p = /^!([1-4])$/.exec(normalized);
		if (p) {
			priority = Number(p[1]);
			continue;
		}
		const a = /^@(\p{L})$/u.exec(normalized);
		if (a && assignees[a[1]]) {
			assignee = assignees[a[1]];
			continue;
		}
		const date = dateFor(normalized, today);
		if (date) {
			dueDate = date;
			continue;
		}
		kept.push(word);
	}

	const title = kept.join(' ');
	// Sans autre mot que la syntaxe (« demain »), tout le texte devient le titre.
	if (!title) return { title: input.trim(), priority: null, dueDate: null, assignee: null };
	return { title, priority, dueDate, assignee };
}
