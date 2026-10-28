import { redirect } from '@sveltejs/kit';
import { lastProProfile } from '$lib/server/last-profile';
import type { PageServerLoad } from './$types';

// Lancement de l'app (start_url) : le dernier profil Pro. Perso ne s'ouvre qu'en tapant /perso.
export const load: PageServerLoad = ({ cookies }) => redirect(307, `/${lastProProfile(cookies)}`);
