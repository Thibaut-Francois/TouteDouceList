<script lang="ts">
	import { SPACES, SPACE_NAMES } from '$lib/spaces';

	let { data, form } = $props();

	const other = $derived(SPACES.find((s) => s !== data.space)!);
</script>

<svelte:head>
	<title>Déverrouiller {SPACE_NAMES[data.space]} · TouteDouceList</title>
</svelte:head>

<main class="unlock">
	<h1>Espace {SPACE_NAMES[data.space]}</h1>

	<form method="POST" action="?/unlock">
		<!-- Identifiant caché : permet au gestionnaire de mots de passe de distinguer les deux espaces. -->
		<input type="text" name="username" value="toutedoucelist-{data.space}" autocomplete="username" hidden />
		<label for="password">Mot de passe</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="password"
			class="field"
			type="password"
			name="password"
			autocomplete="current-password"
			required
			autofocus
		/>
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button class="btn primary" type="submit">Déverrouiller</button>
	</form>

	<a href="/{other}" data-sveltekit-preload-data="off">Aller à l'espace {SPACE_NAMES[other]}</a>
</main>

<style>
	.unlock {
		display: grid;
		gap: 20px;
		max-width: 360px;
		margin: 15vh auto 0;
		padding: 0 16px;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	form {
		display: grid;
		gap: 10px;
	}

	label {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.error {
		margin: 0;
	}
</style>
