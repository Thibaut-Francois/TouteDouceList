export const PRIORITIES = [1, 2, 3, 4] as const;

export const DEFAULT_PRIORITY = 3;

export const PRIORITY_LABELS: Record<number, string> = {
	1: 'Critique',
	2: 'Élevée',
	3: 'Faible',
	4: 'Minime'
};
