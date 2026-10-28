<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { network } from '$lib/network.svelte';
	import { forgetOfflinePages } from '$lib/offline';
	import { PROFILE_NAMES, profilesOf } from '$lib/spaces';

	let { data, children } = $props();

	// Sélecteur des profils Pro, y compris depuis Perso (pour en sortir). Perso n'apparaît nulle part :
	// on n'y entre qu'en tapant son adresse.
	const proProfiles = profilesOf('pro');
	// Changer de profil garde la section ouverte (/thibaut/archive → /philippe/archive).
	const section = $derived(page.url.pathname.slice(data.profile.length + 1));

	const tabs = $derived([
		{ href: `/${data.profile}`, label: 'Tâches' },
		{ href: `/${data.profile}/recurrences`, label: 'Récurrences' },
		{ href: `/${data.profile}/archive`, label: 'Archive' }
	]);

	// Synchronisation entre appareils : rechargement au retour sur l'app ou du réseau.
	let lastRefresh = Date.now();
	function refresh() {
		if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 5000) return;
		lastRefresh = Date.now();
		invalidateAll();
	}

	// Verrouiller efface aussi la copie hors ligne de l'espace sur cet appareil.
	async function lock(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		await forgetOfflinePages(data.space).catch(() => {});
		form.submit();
	}
</script>

<svelte:document onvisibilitychange={refresh} />
<svelte:window ononline={refresh} />

<header class="topbar">
	<!-- Pas de préchargement : il déclencherait la génération des récurrences de l'autre profil. -->
	<nav class="switcher" aria-label="Profils" data-sveltekit-preload-data="off">
		{#each proProfiles as p (p)}
			<a href="/{p}{section}" aria-current={p === data.profile ? 'page' : undefined}>{PROFILE_NAMES[p]}</a>
		{/each}
	</nav>
	{#if data.lockable}
		<form method="POST" action="/{data.profile}/unlock?/lock" onsubmit={lock}>
			<button class="btn ghost" type="submit">Verrouiller</button>
		</form>
	{/if}
	<nav class="tabs" aria-label="Sections">
		{#each tabs as tab (tab.href)}
			<a href={tab.href} aria-current={page.url.pathname === tab.href ? 'page' : undefined}>{tab.label}</a>
		{/each}
	</nav>
</header>

{#if network.offline}
	<p class="offline" role="status">Hors ligne · lecture seule</p>
{/if}

<main class="container">
	{@render children()}
</main>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px var(--gap);
		max-width: 720px;
		margin: 0 auto;
		padding: 8px 16px 0;
		background: var(--bg);
	}

	.offline {
		max-width: 720px;
		margin: 8px auto 0;
		padding: 8px 16px;
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 0.9rem;
		text-align: center;
	}

	.tabs {
		display: flex;
		gap: 4px;
		width: 100%;
		border-bottom: 1px solid var(--border);
	}

	.tabs a {
		display: grid;
		place-items: center;
		min-height: var(--tap);
		padding: 0 12px;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		text-decoration: none;
		font-weight: 600;
	}

	.tabs a[aria-current='page'] {
		border-bottom-color: var(--accent);
		color: var(--text);
	}

	.switcher {
		display: flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.switcher a {
		display: grid;
		place-items: center;
		min-width: 72px;
		min-height: 38px;
		padding: 0 14px;
		border-radius: 7px;
		color: var(--text-muted);
		text-decoration: none;
		font-weight: 600;
	}

	.switcher a[aria-current='page'] {
		background: var(--surface-2);
		color: var(--text);
	}

	@media (max-width: 640px) {
		.switcher a {
			min-width: 0;
			padding: 0 12px;
		}
	}
</style>
