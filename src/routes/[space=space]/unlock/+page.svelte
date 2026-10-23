<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { forgetOfflinePages } from '$lib/offline';
	import { SPACE_NAMES } from '$lib/spaces';

	let { data, form } = $props();

	// Espace verrouillé (bouton ou session expirée) : sa copie hors ligne ne doit plus être lisible.
	onMount(() => {
		forgetOfflinePages(data.space).catch(() => {});
	});
</script>

<svelte:head>
	<title>Déverrouiller {SPACE_NAMES[data.space]} · TouteDouceList</title>
</svelte:head>

<main class="unlock">
	<h1>Espace {SPACE_NAMES[data.space]}</h1>

	<form method="POST" action="?/unlock" use:enhance>
		<label for="code">Code</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="code"
			class="field code"
			type="password"
			name="code"
			inputmode="numeric"
			pattern="[0-9]*"
			maxlength="4"
			autocomplete="off"
			required
			autofocus
		/>
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<button class="btn primary" type="submit">Déverrouiller</button>
	</form>

	<a href="/">Changer d'espace</a>
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

	.code {
		font-size: 1.4rem;
		letter-spacing: 0.4em;
		text-align: center;
	}

	.error {
		margin: 0;
	}
</style>
