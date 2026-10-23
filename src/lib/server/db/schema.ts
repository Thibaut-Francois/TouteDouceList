import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Dates de tâche : texte 'YYYY-MM-DD' (dates flottantes, sans heure).
// Horodatages : millisecondes UTC.

export const spaces = sqliteTable('spaces', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull()
});

export const sessions = sqliteTable(
	'sessions',
	{
		// SHA-256 du jeton : le jeton brut n'existe que dans le cookie.
		id: text('id').primaryKey(),
		spaceId: text('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at').notNull(),
		expiresAt: integer('expires_at').notNull(),
		lastSeenAt: integer('last_seen_at').notNull()
	},
	(t) => [index('sessions_space_idx').on(t.spaceId)]
);

export const loginAttempts = sqliteTable(
	'login_attempts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		spaceId: text('space_id').notNull(),
		ipHash: text('ip_hash').notNull(),
		attemptedAt: integer('attempted_at').notNull(),
		success: integer('success', { mode: 'boolean' }).notNull()
	},
	(t) => [index('login_attempts_space_time_idx').on(t.spaceId, t.attemptedAt)]
);

export const recurrences = sqliteTable(
	'recurrences',
	{
		id: text('id').primaryKey(),
		spaceId: text('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		notes: text('notes').notNull().default(''),
		priority: integer('priority').notNull().default(3),
		rrule: text('rrule').notNull(),
		preset: text('preset').notNull(),
		startDate: text('start_date').notNull(),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		lastGeneratedDate: text('last_generated_date'),
		deletedAt: integer('deleted_at')
	},
	(t) => [
		index('recurrences_space_idx').on(t.spaceId),
		check('recurrences_priority_check', sql`${t.priority} BETWEEN 1 AND 4`)
	]
);

export const tasks = sqliteTable(
	'tasks',
	{
		// UUID généré côté client : création optimiste et idempotente.
		id: text('id').primaryKey(),
		spaceId: text('space_id')
			.notNull()
			.references(() => spaces.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		notes: text('notes').notNull().default(''),
		priority: integer('priority').notNull().default(3),
		dueDate: text('due_date'),
		status: text('status', { enum: ['open', 'done'] })
			.notNull()
			.default('open'),
		createdAt: integer('created_at').notNull(),
		completedAt: integer('completed_at'),
		recurrenceId: text('recurrence_id').references(() => recurrences.id, {
			onDelete: 'set null'
		}),
		occurrenceDate: text('occurrence_date'),
		// Titre + notes en minuscules sans accents (searchText) : recherche de l'archive.
		search: text('search').notNull().default('')
	},
	(t) => [
		uniqueIndex('tasks_recurrence_occurrence_uq').on(t.recurrenceId, t.occurrenceDate),
		index('tasks_space_status_due_idx').on(t.spaceId, t.status, t.dueDate),
		index('tasks_space_completed_idx').on(t.spaceId, t.completedAt),
		check('tasks_priority_check', sql`${t.priority} BETWEEN 1 AND 4`),
		check('tasks_status_check', sql`${t.status} IN ('open', 'done')`)
	]
);
