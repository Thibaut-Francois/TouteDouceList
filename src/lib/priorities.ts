export const PRIORITIES = [1, 2, 3, 4] as const;

export const DEFAULT_PRIORITY = 3;

export const PRIORITY_LABELS: Record<number, string> = {
	1: 'Critique',
	2: 'Élevée',
	3: 'Faible',
	4: 'Minime'
};

/** Couleur du chiffre du badge ; contraste AA vérifié sur les fonds sombres (tests/priorities.test.ts). */
export const PRIORITY_COLORS: Record<number, string> = {
	1: '#ff8593',
	2: '#ffb86b',
	3: '#8ab4f8',
	4: '#a7adb7'
};
