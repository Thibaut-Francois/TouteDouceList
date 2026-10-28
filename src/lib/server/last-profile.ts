import type { Cookies } from '@sveltejs/kit';
import { DEFAULT_PROFILE, isProfileId, PROFILE_SPACE, type ProfileId } from '$lib/spaces';

// Dernier profil Pro ouvert sur cet appareil : l'app (/, /pro/…) le rouvre par défaut.
const COOKIE = 'tdl_profile';

export function rememberProfile(cookies: Cookies, profile: ProfileId) {
	if (PROFILE_SPACE[profile] !== 'pro' || cookies.get(COOKIE) === profile) return;
	cookies.set(COOKIE, profile, { path: '/', maxAge: 365 * 24 * 3600, httpOnly: true, sameSite: 'lax' });
}

export function lastProProfile(cookies: Cookies): ProfileId {
	const value = cookies.get(COOKIE);
	return isProfileId(value) && PROFILE_SPACE[value] === 'pro' ? value : DEFAULT_PROFILE.pro;
}
