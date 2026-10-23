import { error } from '@sveltejs/kit';
import { sanitizePreset } from '$lib/recurrence/presets';
import type { RecurrenceInput, RecurrencePatch } from './repo/recurrences';
import type { ArchiveCursor, NewTaskInput, TaskPatch } from './repo/tasks';

type Body = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TITLE_MAX = 500;
export const NOTES_MAX = 10_000;

function invalid(field: string): never {
	error(400, `Champ invalide : ${field}`);
}

export async function readJson(request: Request): Promise<Body> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'JSON invalide');
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		error(400, 'Objet JSON attendu');
	}
	return body as Body;
}

export function isValidDate(value: string) {
	if (!DATE_RE.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function title(value: unknown) {
	if (typeof value !== 'string') invalid('title');
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > TITLE_MAX) invalid('title');
	return trimmed;
}

function notes(value: unknown) {
	if (typeof value !== 'string' || value.length > NOTES_MAX) invalid('notes');
	return value;
}

function priority(value: unknown) {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 4) {
		invalid('priority');
	}
	return value;
}

function dueDate(value: unknown) {
	if (value === null) return null;
	if (typeof value !== 'string' || !isValidDate(value)) invalid('dueDate');
	return value;
}

function status(value: unknown) {
	if (value !== 'open' && value !== 'done') invalid('status');
	return value;
}

export function parseNewTask(body: Body): NewTaskInput {
	if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) invalid('id');
	return {
		id: body.id.toLowerCase(),
		title: title(body.title),
		notes: body.notes === undefined ? '' : notes(body.notes),
		priority: body.priority === undefined ? 3 : priority(body.priority),
		dueDate: body.dueDate === undefined ? null : dueDate(body.dueDate)
	};
}

function preset(value: unknown) {
	return sanitizePreset(value) ?? invalid('preset');
}

function startDate(value: unknown) {
	if (typeof value !== 'string' || !isValidDate(value)) invalid('startDate');
	return value;
}

export function parseRecurrenceInput(body: Body): RecurrenceInput {
	return {
		title: title(body.title),
		notes: body.notes === undefined ? '' : notes(body.notes),
		priority: body.priority === undefined ? 3 : priority(body.priority),
		preset: preset(body.preset),
		startDate: startDate(body.startDate)
	};
}

export function parseRecurrencePatch(body: Body): RecurrencePatch {
	const patch: RecurrencePatch = {};
	if (body.title !== undefined) patch.title = title(body.title);
	if (body.notes !== undefined) patch.notes = notes(body.notes);
	if (body.priority !== undefined) patch.priority = priority(body.priority);
	if (body.preset !== undefined) patch.preset = preset(body.preset);
	if (body.startDate !== undefined) patch.startDate = startDate(body.startDate);
	if (body.active !== undefined) {
		if (typeof body.active !== 'boolean') invalid('active');
		patch.active = body.active;
	}
	return patch;
}

/** Curseur d'archive « <completedAt>:<id> » ; absent → première page. */
export function parseArchiveCursor(value: string | null): ArchiveCursor | undefined {
	if (value === null || value === '') return undefined;
	const match = /^(\d{1,15}):([0-9a-f-]{36})$/i.exec(value);
	if (!match || !UUID_RE.test(match[2])) invalid('after');
	return { completedAt: Number(match[1]), id: match[2].toLowerCase() };
}

export function parseTaskPatch(body: Body): TaskPatch {
	const patch: TaskPatch = {};
	if (body.title !== undefined) patch.title = title(body.title);
	if (body.notes !== undefined) patch.notes = notes(body.notes);
	if (body.priority !== undefined) patch.priority = priority(body.priority);
	if (body.dueDate !== undefined) patch.dueDate = dueDate(body.dueDate);
	if (body.status !== undefined) patch.status = status(body.status);
	return patch;
}
