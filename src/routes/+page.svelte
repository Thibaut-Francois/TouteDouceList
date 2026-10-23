<script lang="ts">
	import { SPACES, SPACE_NAMES } from '$lib/spaces';
</script>

<svelte:head>
	<title>TouteDouceList</title>
</svelte:head>

<!-- Écran de lancement (start_url de la PWA) : choix de l'espace. -->
<main class="home">
	<h1>TouteDouceList</h1>
	<nav aria-label="Espaces">
		{#each SPACES as space (space)}
			<a class="space" href="/{space}" data-sveltekit-preload-data="off">{SPACE_NAMES[space]}</a>
		{/each}
	</nav>
</main>

<style>
	.home {
		display: grid;
		gap: 32px;
		max-width: 420px;
		margin: 18vh auto 0;
		padding: 0 16px;
		text-align: center;
	}

	h1 {
		margin: 0;
		color: var(--text-muted);
		font-size: 1.1rem;
		font-weight: 600;
	}

	nav {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.space {
		display: grid;
		place-items: center;
		min-height: 120px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		color: var(--text);
		font-size: 1.4rem;
		font-weight: 700;
		text-decoration: none;
	}

	.space:hover,
	.space:focus-visible {
		border-color: var(--accent);
	}
</style>
