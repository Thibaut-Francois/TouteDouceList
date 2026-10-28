// Dates de tâche : 'YYYY-MM-DD' flottantes, manipulées en UTC pour échapper aux changements d'heure.
// Seul « aujourd'hui » dépend du fuseau, toujours Europe/Paris.

const PARIS_DATE = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Europe/Paris',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

export function todayInParis(now: Date = new Date()) {
	const parts = Object.fromEntries(PARIS_DATE.formatToParts(now).map((p) => [p.type, p.value]));
	return `${parts.year}-${parts.month}-${parts.day}`;
}

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
	const d = toUtc(date);
	d.setUTCDate(d.getUTCDate() + days);
	return fromUtc(d);
}

/** 0 = dimanche … 6 = samedi. */
export function dayOfWeek(date: string) {
	return toUtc(date).getUTCDay();
}

export function diffDays(a: string, b: string) {
	return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86_400_000);
}

/** Lundi de la semaine (du lundi au dimanche) qui contient la date. */
export function startOfWeek(date: string) {
	return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

const NUMERIC = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'UTC',
	day: '2-digit',
	month: '2-digit',
	year: 'numeric'
});

const LONG = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'UTC',
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric'
});

const INSTANT = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'Europe/Paris',
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});

/** Horodatage (ms UTC) à l'heure de Paris : « ven. 23 oct. 2026, 14:05 ». */
export function formatInstant(ms: number) {
	return INSTANT.format(new Date(ms));
}

const RELATIVE: Record<number, string> = {
	[-1]: 'hier',
	0: "aujourd'hui",
	1: 'demain',
	2: 'après-demain'
};

/**
 * Date de tâche ou d'étape, partout dans l'app : « hier », « aujourd'hui », « demain » ou
 * « après-demain » seulement dans la semaine en cours, sinon « 31/10/2026 ».
 */
export function formatTaskDate(date: string, today: string, { capitalize = false } = {}) {
	const relative =
		startOfWeek(date) === startOfWeek(today) ? RELATIVE[diffDays(date, today)] : undefined;
	if (!relative) return NUMERIC.format(toUtc(date));
	return capitalize ? relative[0].toUpperCase() + relative.slice(1) : relative;
}

/** Date complète, affichée au survol : « mercredi 28 octobre 2026 ». */
export function formatDateTitle(date: string) {
	return LONG.format(toUtc(date));
}

