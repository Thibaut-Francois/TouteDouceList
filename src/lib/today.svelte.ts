import { browser } from '$app/environment';
import { todayInParis } from './dates';

/**
 * « Aujourd'hui » (Paris) partagé par toute l'interface. Recalculé quand l'app revient au
 * premier plan : une app restée ouverte après minuit met ses libellés à jour.
 * Côté serveur, recalculé à chaque lecture (le module vit d'une requête à l'autre).
 */
class Today {
	#value = $state(todayInParis());

	get value() {
		return browser ? this.#value : todayInParis();
	}

	refresh() {
		this.#value = todayInParis();
	}
}

export const today = new Today();

if (browser) {
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') today.refresh();
	});
}
