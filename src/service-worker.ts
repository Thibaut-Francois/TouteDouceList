/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
import { isCachablePage, LAST_PROFILE_KEY, PAGES_CACHE, proProfileOf } from '$lib/offline';
import { DEFAULT_PROFILE } from '$lib/spaces';

const sw = self as unknown as ServiceWorkerGlobalScope;

const ASSETS_CACHE = `assets-${version}`;
const ASSETS = new Set([...build, ...files]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(ASSETS_CACHE)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k.startsWith('assets-') && k !== ASSETS_CACHE).map((k) => caches.delete(k))
				)
			)
			.then(forgetObsoletePages)
			.then(() => sw.clients.claim())
	);
});

const OFFLINE_PAGE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hors ligne</title><body style="margin:0;padding:15vh 24px;background:#121316;color:#e8e9ec;font:16px system-ui,sans-serif;text-align:center"><p>Hors ligne.</p><p style="color:#9aa0ab">Cette page n'a pas encore été consultée sur cet appareil.</p></body></html>`;

/** Réseau d'abord ; la dernière réponse réussie sert hors ligne. */
async function networkFirst(request: Request) {
	const cache = await caches.open(PAGES_CACHE);
	try {
		const response = await fetch(request);
		// Une redirection (vers le déverrouillage) ou une erreur ne remplace jamais la copie hors ligne.
		if (response.ok && !response.redirected && response.type === 'basic') {
			await cache.put(request, response.clone());
			const profile = proProfileOf(new URL(request.url).pathname);
			if (profile) await cache.put(LAST_PROFILE_KEY, new Response(profile));
		}
		return response;
	} catch (error) {
		const cached =
			(await cache.match(request)) ?? (await cache.match(request, { ignoreSearch: true }));
		if (cached) return cached;
		if (request.mode === 'navigate') return offlinePage();
		throw error;
	}
}

function offlinePage() {
	return new Response(OFFLINE_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** Lancement de l'app : `/` redirige vers le dernier profil Pro, hors ligne aussi (sa copie prend le relais). */
async function startPage(request: Request) {
	try {
		return await fetch(request);
	} catch {
		const last = await (await caches.open(PAGES_CACHE)).match(LAST_PROFILE_KEY);
		const profile = (last && proProfileOf(`/${await last.text()}`)) ?? DEFAULT_PROFILE.pro;
		return Response.redirect(`/${profile}`, 302);
	}
}

/** Copies de pages qui ne seraient plus conservées aujourd'hui (anciennes adresses /pro). */
async function forgetObsoletePages() {
	const cache = await caches.open(PAGES_CACHE);
	for (const request of await cache.keys()) {
		const path = new URL(request.url).pathname;
		if (path !== LAST_PROFILE_KEY && !isCachablePage(path)) await cache.delete(request);
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	if (url.pathname === '/' && request.mode === 'navigate') {
		event.respondWith(startPage(request));
		return;
	}
	if (ASSETS.has(url.pathname)) {
		event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
		return;
	}
	if (isCachablePage(url.pathname)) event.respondWith(networkFirst(request));
});
