import { DEFAULT_VIEW, sanitizeView, type View } from './filters';
import type { SpaceId } from './spaces';

// Filtres et tri mémorisés par espace et par appareil, dans un cookie plutôt que dans localStorage :
// le serveur les applique dès le premier rendu, sans affichage intermédiaire non filtré.
// La recherche texte n'est pas mémorisée, pour ne pas rouvrir l'app sur une liste vide sans raison.

export const viewCookieName = (space: SpaceId) => `tdl_view_${space}`;

export function parseView(value: string | undefined): View {
	if (!value) return { ...DEFAULT_VIEW };
	try {
		return { ...sanitizeView(JSON.parse(value)), query: '' };
	} catch {
		return { ...DEFAULT_VIEW };
	}
}

export function saveView(space: SpaceId, { priorities, due, kinds, sort }: View) {
	const value = encodeURIComponent(JSON.stringify({ priorities, due, kinds, sort }));
	document.cookie = `${viewCookieName(space)}=${value}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}
