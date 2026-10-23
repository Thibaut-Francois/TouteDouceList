export const SPACES = ['pro', 'perso'] as const;

export type SpaceId = (typeof SPACES)[number];

export const SPACE_NAMES: Record<SpaceId, string> = {
	pro: 'Pro',
	perso: 'Perso'
};

export function isSpaceId(value: unknown): value is SpaceId {
	return SPACES.includes(value as SpaceId);
}
