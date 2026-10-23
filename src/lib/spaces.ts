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
