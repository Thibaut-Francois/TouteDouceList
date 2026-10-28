import { json } from '@sveltejs/kit';
import { todayInParis } from '$lib/dates';
import { presetToRrule, sanitizePreset } from '$lib/recurrence/presets';
import { requireScope } from '$lib/server/auth';
import { nextOccurrences } from '$lib/server/recurrence/engine';
import { isValidDate, readJson } from '$lib/server/validate';
import type { RequestHandler } from './$types';

const PREVIEW_COUNT = 5;

/** Aperçu des prochaines dates d'une règle, calculé ici pour garder rrule hors du bundle client. */
export const POST: RequestHandler = async (event) => {
	await requireScope(event, event.params.profile);
	const body = await readJson(event.request);
	const preset = sanitizePreset(body.preset);
	if (!preset || typeof body.startDate !== 'string' || !isValidDate(body.startDate)) {
		return json({ dates: [] });
	}
	const today = todayInParis();
	const from = body.startDate > today ? body.startDate : today;
	return json({ dates: nextOccurrences(presetToRrule(preset), body.startDate, from, PREVIEW_COUNT) });
};
