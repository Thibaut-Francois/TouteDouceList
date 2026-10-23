// Préréglages de récurrence → règle RRULE (RFC 5545). Partagé client/serveur, sans dépendance :
// le serveur recalcule toujours la règle à partir du préréglage, il ne fait pas confiance au client.

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
	MO: 'lundi',
	TU: 'mardi',
	WE: 'mercredi',
	TH: 'jeudi',
	FR: 'vendredi',
	SA: 'samedi',
	SU: 'dimanche'
};

export const NTHS = [1, 2, 3, 4, -1] as const;
export type Nth = (typeof NTHS)[number];

export const NTH_LABELS: Record<Nth, string> = {
	1: 'premier',
	2: 'deuxième',
	3: 'troisième',
	4: 'quatrième',
	[-1]: 'dernier'
};

export const MONTH_LABELS = [
	'janvier',
	'février',
	'mars',
	'avril',
	'mai',
	'juin',
	'juillet',
	'août',
	'septembre',
	'octobre',
	'novembre',
	'décembre'
];

export const UNITS = ['day', 'week', 'month', 'year'] as const;
export type Unit = (typeof UNITS)[number];

export type Preset =
	| { kind: 'daily' }
	| { kind: 'weekdays' }
	| { kind: 'weekly'; day: Weekday }
	| { kind: 'monthly-day'; day: number }
	| { kind: 'monthly-nth'; nth: Nth; day: Weekday }
	| { kind: 'month-last-day' }
	| { kind: 'yearly'; month: number; day: number }
	| { kind: 'custom'; interval: number; unit: Unit; days: Weekday[] };

export type PresetKind = Preset['kind'];

export const PRESET_KINDS: { kind: PresetKind; label: string }[] = [
	{ kind: 'daily', label: 'Tous les jours' },
	{ kind: 'weekdays', label: 'Jours ouvrés (lundi → vendredi)' },
	{ kind: 'weekly', label: 'Chaque semaine le…' },
	{ kind: 'monthly-day', label: 'Chaque mois le…' },
	{ kind: 'monthly-nth', label: 'Le n-ième jour de la semaine du mois' },
	{ kind: 'month-last-day', label: 'Le dernier jour du mois' },
	{ kind: 'yearly', label: 'Chaque année' },
	{ kind: 'custom', label: 'Personnalisée' }
];

export const INTERVAL_MAX = 99;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// « Le 29/30/31 » est ramené au dernier jour des mois plus courts : premier jour du mois parmi {N, dernier}.
const dayOrLast = (day: number) => (day > 28 ? `BYMONTHDAY=${day},-1;BYSETPOS=1` : `BYMONTHDAY=${day}`);

const UNIT_FREQ: Record<Unit, string> = {
	day: 'DAILY',
	week: 'WEEKLY',
	month: 'MONTHLY',
	year: 'YEARLY'
};

export function presetToRrule(preset: Preset): string {
	switch (preset.kind) {
		case 'daily':
			return 'FREQ=DAILY';
		case 'weekdays':
			return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
		case 'weekly':
			return `FREQ=WEEKLY;BYDAY=${preset.day}`;
		case 'monthly-day':
			return `FREQ=MONTHLY;${dayOrLast(preset.day)}`;
		case 'monthly-nth':
			return `FREQ=MONTHLY;BYDAY=${preset.nth}${preset.day}`;
		case 'month-last-day':
			return 'FREQ=MONTHLY;BYMONTHDAY=-1';
		case 'yearly':
			return `FREQ=YEARLY;BYMONTH=${preset.month};${dayOrLast(preset.day)}`;
		case 'custom': {
			const days = preset.unit === 'week' && preset.days.length ? `;BYDAY=${sortDays(preset.days).join(',')}` : '';
			return `FREQ=${UNIT_FREQ[preset.unit]};INTERVAL=${preset.interval}${days}`;
		}
	}
}

const sortDays = (days: Weekday[]) => WEEKDAYS.filter((d) => days.includes(d));

const ordinal = (n: number) => (n === 1 ? '1er' : String(n));

const UNIT_LABELS: Record<Unit, [one: string, many: string]> = {
	day: ['Chaque jour', 'jours'],
	week: ['Chaque semaine', 'semaines'],
	month: ['Chaque mois', 'mois'],
	year: ['Chaque année', 'ans']
};

export function describePreset(preset: Preset): string {
	switch (preset.kind) {
		case 'daily':
			return 'Tous les jours';
		case 'weekdays':
			return 'Jours ouvrés (lundi → vendredi)';
		case 'weekly':
			return `Chaque ${WEEKDAY_LABELS[preset.day]}`;
		case 'monthly-day':
			return `Le ${ordinal(preset.day)} de chaque mois${preset.day > 28 ? ' (ou le dernier jour)' : ''}`;
		case 'monthly-nth':
			return `Le ${NTH_LABELS[preset.nth]} ${WEEKDAY_LABELS[preset.day]} du mois`;
		case 'month-last-day':
			return 'Le dernier jour du mois';
		case 'yearly':
			return `Chaque année le ${ordinal(preset.day)} ${MONTH_LABELS[preset.month - 1]}`;
		case 'custom': {
			const [one, many] = UNIT_LABELS[preset.unit];
			const base = preset.interval === 1 ? one : `Tous les ${preset.interval} ${many}`;
			const days =
				preset.unit === 'week' && preset.days.length
					? ` (${sortDays(preset.days).map((d) => WEEKDAY_LABELS[d]).join(', ')})`
					: '';
			return base + days;
		}
	}
}

const isInt = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isWeekday = (v: unknown): v is Weekday => WEEKDAYS.includes(v as Weekday);

/** Préréglage reçu du client ou lu en base ; null s'il est invalide. */
export function sanitizePreset(raw: unknown): Preset | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const p = raw as Record<string, unknown>;
	switch (p.kind) {
		case 'daily':
		case 'weekdays':
		case 'month-last-day':
			return { kind: p.kind };
		case 'weekly':
			return isWeekday(p.day) ? { kind: 'weekly', day: p.day } : null;
		case 'monthly-day':
			return isInt(p.day, 1, 31) ? { kind: 'monthly-day', day: p.day } : null;
		case 'monthly-nth':
			return NTHS.includes(p.nth as Nth) && isWeekday(p.day)
				? { kind: 'monthly-nth', nth: p.nth as Nth, day: p.day }
				: null;
		case 'yearly':
			return isInt(p.month, 1, 12) && isInt(p.day, 1, DAYS_IN_MONTH[(p.month as number) - 1])
				? { kind: 'yearly', month: p.month as number, day: p.day as number }
				: null;
		case 'custom': {
			if (!isInt(p.interval, 1, INTERVAL_MAX) || !UNITS.includes(p.unit as Unit)) return null;
			if (!Array.isArray(p.days) || !p.days.every(isWeekday)) return null;
			const unit = p.unit as Unit;
			return { kind: 'custom', interval: p.interval, unit, days: unit === 'week' ? sortDays(p.days) : [] };
		}
		default:
			return null;
	}
}

/** Préréglage par défaut d'un type, calé sur la date de début. */
export function defaultPreset(kind: PresetKind, startDate: string): Preset {
	const date = new Date(`${startDate}T00:00:00Z`);
	const day = WEEKDAYS[(date.getUTCDay() + 6) % 7];
	const dom = date.getUTCDate();
	switch (kind) {
		case 'daily':
		case 'weekdays':
		case 'month-last-day':
			return { kind };
		case 'weekly':
			return { kind, day };
		case 'monthly-day':
			return { kind, day: dom };
		case 'monthly-nth':
			return { kind, nth: Math.min(Math.ceil(dom / 7), 4) as Nth, day };
		case 'yearly':
			return { kind, month: date.getUTCMonth() + 1, day: dom };
		case 'custom':
			return { kind, interval: 1, unit: 'week', days: [day] };
	}
}
