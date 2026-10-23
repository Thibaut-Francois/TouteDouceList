import { RRule } from 'rrule';

// Les occurrences sont calculées en dates flottantes : dtstart à minuit UTC, sans TZID.
// Les changements d'heure n'ont donc aucun effet ; seul « aujourd'hui » dépend d'Europe/Paris.

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

function ruleFor(rrule: string, startDate: string) {
	return new RRule({ ...RRule.parseString(rrule), dtstart: toUtc(startDate) });
}

/** Occurrences entre from et to inclus (dates 'YYYY-MM-DD'), jamais avant la date de début. */
export function occurrencesBetween(rrule: string, startDate: string, from: string, to: string) {
	if (to < from) return [];
	return ruleFor(rrule, startDate).between(toUtc(from), toUtc(to), true).map(fromUtc);
}

/** Les `count` prochaines occurrences à partir de from inclus. */
export function nextOccurrences(rrule: string, startDate: string, from: string, count: number) {
	const rule = ruleFor(rrule, startDate);
	const dates: string[] = [];
	let next = rule.after(toUtc(from), true);
	while (next && dates.length < count) {
		dates.push(fromUtc(next));
		next = rule.after(next, false);
	}
	return dates;
}
