import { error, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { createHash, randomBytes } from 'node:crypto';
import { and, count, eq, gt, lt, type SQL } from 'drizzle-orm';
import { isSpaceId, type SpaceId } from '$lib/spaces';
import type { Db } from './db/client';
import { loginAttempts, sessions, spaces } from './db/schema';
import { verifyPassword } from './password';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const SESSION_TTL_MS = 180 * DAY_MS;
// Prolongation glissante, au plus une écriture par jour et par session.
const SESSION_RENEW_AFTER_MS = DAY_MS;

export const IP_WINDOW_MS = 15 * MINUTE_MS;
export const IP_MAX_FAILURES = 5;
export const SPACE_WINDOW_MS = 60 * MINUTE_MS;
export const SPACE_MAX_FAILURES = 20;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const cookieName = (space: SpaceId) => `tdl_${space}`;

// --- Sessions ---

export async function createSession(db: Db, spaceId: SpaceId, now = Date.now()) {
	const token = randomBytes(32).toString('base64url');
	await db.delete(sessions).where(lt(sessions.expiresAt, now));
	await db.insert(sessions).values({
		id: sha256(token),
		spaceId,
		createdAt: now,
		expiresAt: now + SESSION_TTL_MS,
		lastSeenAt: now
	});
	return token;
}

export type SessionStatus = 'invalid' | 'valid' | 'renewed';

export async function validateSession(
	db: Db,
	spaceId: SpaceId,
	token: string,
	now = Date.now()
): Promise<SessionStatus> {
	const [session] = await db
		.select()
		.from(sessions)
		.where(
			and(eq(sessions.id, sha256(token)), eq(sessions.spaceId, spaceId), gt(sessions.expiresAt, now))
		)
		.limit(1);
	if (!session) return 'invalid';
	if (now - session.lastSeenAt < SESSION_RENEW_AFTER_MS) return 'valid';
	await db
		.update(sessions)
		.set({ lastSeenAt: now, expiresAt: now + SESSION_TTL_MS })
		.where(eq(sessions.id, session.id));
	return 'renewed';
}

export async function deleteSession(db: Db, token: string) {
	await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

// --- Déverrouillage et limitation des tentatives ---

async function countFailures(db: Db, where: SQL | undefined) {
	const [row] = await db.select({ n: count() }).from(loginAttempts).where(where);
	return row.n;
}

export async function isRateLimited(db: Db, spaceId: SpaceId, ipHash: string, now = Date.now()) {
	const failed = and(eq(loginAttempts.spaceId, spaceId), eq(loginAttempts.success, false));
	const ipFailures = await countFailures(
		db,
		and(failed, eq(loginAttempts.ipHash, ipHash), gt(loginAttempts.attemptedAt, now - IP_WINDOW_MS))
	);
	if (ipFailures >= IP_MAX_FAILURES) return true;
	const spaceFailures = await countFailures(
		db,
		and(failed, gt(loginAttempts.attemptedAt, now - SPACE_WINDOW_MS))
	);
	return spaceFailures >= SPACE_MAX_FAILURES;
}

export type UnlockResult =
	| { ok: true; token: string }
	| { ok: false; reason: 'invalid' | 'rate_limited' };

export async function attemptUnlock(
	db: Db,
	spaceId: SpaceId,
	password: string,
	ip: string,
	now = Date.now()
): Promise<UnlockResult> {
	const ipHash = sha256(ip);
	if (await isRateLimited(db, spaceId, ipHash, now)) return { ok: false, reason: 'rate_limited' };

	const [space] = await db
		.select({ passwordHash: spaces.passwordHash })
		.from(spaces)
		.where(eq(spaces.id, spaceId))
		.limit(1);
	const ok = space !== undefined && (await verifyPassword(space.passwordHash, password));

	await db.insert(loginAttempts).values({ spaceId, ipHash, attemptedAt: now, success: ok });
	await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, now - DAY_MS));

	if (!ok) return { ok: false, reason: 'invalid' };
	return { ok: true, token: await createSession(db, spaceId, now) };
}

// --- Cookies et garde des routes ---

export function setSessionCookie(cookies: Cookies, space: SpaceId, token: string) {
	cookies.set(cookieName(space), token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: SESSION_TTL_MS / 1000
	});
}

export function clearSessionCookie(cookies: Cookies, space: SpaceId) {
	cookies.delete(cookieName(space), { path: '/' });
}

export async function isUnlocked(event: RequestEvent, space: SpaceId) {
	const cached = event.locals.unlocked[space];
	if (cached !== undefined) return cached;

	const token = event.cookies.get(cookieName(space));
	const status = token ? await validateSession(event.locals.db, space, token) : 'invalid';
	if (status === 'renewed') setSessionCookie(event.cookies, space, token!);

	return (event.locals.unlocked[space] = status !== 'invalid');
}

/**
 * À appeler au début de chaque load et de chaque endpoint d'un espace.
 * Renvoie l'espace validé ; sinon 404 (espace inconnu), 401 ou redirection vers le déverrouillage.
 */
export async function requireSpace(
	event: RequestEvent,
	space: string,
	{ onLocked = 'error' }: { onLocked?: 'error' | 'redirect' } = {}
): Promise<SpaceId> {
	if (!isSpaceId(space)) error(404, 'Espace inconnu');
	if (await isUnlocked(event, space)) return space;
	if (onLocked === 'redirect') redirect(303, `/${space}/unlock`);
	error(401, 'Espace verrouillé');
}
