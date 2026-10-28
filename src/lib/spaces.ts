export const SPACES = ['pro', 'perso'] as const;

export type SpaceId = (typeof SPACES)[number];

export const SPACE_NAMES: Record<SpaceId, string> = {
	pro: 'Pro',
	perso: 'Perso'
};

export function isSpaceId(value: unknown): value is SpaceId {
	return SPACES.includes(value as SpaceId);
}

/**
 * Seul Perso demande un code (le code du jour, vérifié côté serveur).
 * Pro est en accès libre : choix assumé de l'utilisateur, quiconque a l'adresse du site peut l'ouvrir.
 */
export function isProtected(space: SpaceId) {
	return space === 'perso';
}

/**
 * Profils : chaque tâche et chaque récurrence appartient à un profil de son espace.
 * Pro en a deux (Thibaut, Philippe), Perso un seul, invisible dans l'interface.
 * Les identifiants servent aussi d'adresse (/thibaut, /philippe, /perso).
 */
export const PROFILES = ['thibaut', 'philippe', 'perso'] as const;

export type ProfileId = (typeof PROFILES)[number];

export const PROFILE_NAMES: Record<ProfileId, string> = {
	thibaut: 'Thibaut',
	philippe: 'Philippe',
	perso: 'Perso'
};

export const PROFILE_SPACE: Record<ProfileId, SpaceId> = {
	thibaut: 'pro',
	philippe: 'pro',
	perso: 'perso'
};

export function isProfileId(value: unknown): value is ProfileId {
	return PROFILES.includes(value as ProfileId);
}

export function profilesOf(space: SpaceId) {
	return PROFILES.filter((p) => PROFILE_SPACE[p] === space);
}

/** Profil ouvert par défaut dans un espace (en l'absence de dernier profil mémorisé). */
export const DEFAULT_PROFILE: Record<SpaceId, ProfileId> = { pro: 'thibaut', perso: 'perso' };

/** Un profil et son espace : ce que filtre chaque accès aux tâches et aux récurrences. */
export type Scope = { spaceId: SpaceId; profileId: ProfileId };

export const scopeOf = (profileId: ProfileId): Scope => ({ spaceId: PROFILE_SPACE[profileId], profileId });
