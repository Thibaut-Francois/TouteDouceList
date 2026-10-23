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

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long' });
const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'UTC',
	weekday: 'short',
	day: 'numeric',
	month: 'short'
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'UTC',
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});

const FULL = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'UTC',
	weekday: 'short',
	day: 'numeric',
	month: 'short',
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

/** « mar. 27 oct. 2026 » */
export function formatFull(date: string) {
	return FULL.format(toUtc(date));
}

export function formatDue(date: string, today: string) {
	const diff = diffDays(date, today);
	if (diff === 0) return "Aujourd'hui";
	if (diff === 1) return 'Demain';
	if (diff === -1) return 'Hier';
	const d = toUtc(date);
	if (diff > 1 && diff < 7) return WEEKDAY.format(d);
	if (date.slice(0, 4) === today.slice(0, 4)) return DAY_MONTH.format(d);
	return DAY_MONTH_YEAR.format(d);
}
