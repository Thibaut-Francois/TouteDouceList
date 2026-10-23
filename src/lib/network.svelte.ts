/** État du réseau ; hors ligne, l'app passe en lecture seule. */
class Network {
	offline = $state(false);
}

export const network = new Network();

if (typeof window !== 'undefined') {
	network.offline = !navigator.onLine;
	window.addEventListener('online', () => (network.offline = false));
	window.addEventListener('offline', () => (network.offline = true));
}

export const OFFLINE_MESSAGE = 'Hors ligne : lecture seule.';
