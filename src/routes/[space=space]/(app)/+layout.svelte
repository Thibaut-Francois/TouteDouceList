<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { SPACES, SPACE_NAMES } from '$lib/spaces';

	let { data, children } = $props();

	const tabs = $derived([
		{ href: `/${data.space}`, label: 'Tâches' },
		{ href: `/${data.space}/recurrences`, label: 'Récurrences' },
		{ href: `/${data.space}/archive`, label: 'Archive' }
	]);

	// Synchronisation entre appareils : rechargement au retour sur l'app ou du réseau.
	let lastRefresh = Date.now();
	function refresh() {
		if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 5000) return;
		lastRefresh = Date.now();
		invalidateAll();
	}
</script>

<svelte:document onvisibilitychange={refresh} />
<svelte:window ononline={refresh} />

<header class="topbar">
	<!-- Pas de préchargement : il déclencherait le load (et la mémorisation) de l'autre espace. -->
	<nav class="switcher" aria-label="Espaces" data-sveltekit-preload-data="off">
		{#each SPACES as s (s)}
			<a href="/{s}" aria-current={s === data.space ? 'page' : undefined}>{SPACE_NAMES[s]}</a>
		{/each}
	</nav>
	<form method="POST" action="/{data.space}/unlock?/lock">
		<button class="btn ghost" type="submit">Verrouiller</button>
	</form>
	<nav class="tabs" aria-label="Sections">
		{#each tabs as tab (tab.href)}
			<a href={tab.href} aria-current={page.url.pathname === tab.href ? 'page' : undefined}>{tab.label}</a>
		{/each}
	</nav>
</header>

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
</style>
