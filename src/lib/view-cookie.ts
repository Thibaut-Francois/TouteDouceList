import type { Cookies } from '@sveltejs/kit';
import { DEFAULT_VIEW, sanitizeView, type View } from './filters';
import type { ProfileId } from './spaces';

// Filtres et tri mémorisés par profil et par appareil, dans un cookie plutôt que dans localStorage :
// le serveur les applique dès le premier rendu, sans affichage intermédiaire non filtré.
// La recherche texte n'est pas mémorisée, pour ne pas rouvrir l'app sur une liste vide sans raison.

export const viewCookieName = (profile: ProfileId) => `tdl_view_${profile}`;

// Avant les profils, la vue de Pro était mémorisée sous tdl_view_pro : elle revient à Thibaut.
const LEGACY_COOKIE: Partial<Record<ProfileId, string>> = { thibaut: 'tdl_view_pro' };

export function readView(cookies: Cookies, profile: ProfileId): View {
	const legacy = LEGACY_COOKIE[profile];
	return parseView(cookies.get(viewCookieName(profile)) ?? (legacy && cookies.get(legacy)));
}

export function parseView(value: string | undefined): View {
	if (!value) return { ...DEFAULT_VIEW };
	try {
		return { ...sanitizeView(JSON.parse(value)), query: '' };
	} catch {
		return { ...DEFAULT_VIEW };
	}
}

export function saveView(profile: ProfileId, { priorities, due, kinds, sort }: View) {
	const value = encodeURIComponent(JSON.stringify({ priorities, due, kinds, sort }));
	document.cookie = `${viewCookieName(profile)}=${value}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}
