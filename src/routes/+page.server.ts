import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Lancement de l'app (start_url) : Pro directement. Perso ne s'ouvre qu'en tapant /perso.
export const load: PageServerLoad = () => redirect(307, '/pro');
