<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { forgetOfflinePages } from '$lib/offline';
	import { SPACE_NAMES } from '$lib/spaces';

	let { data, form } = $props();

	const CODE_LENGTH = 4;
	const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

	let code = $state('');
	let phone = $state(false);
	let formEl: HTMLFormElement;

	// Espace verrouillé (bouton ou session expirée) : sa copie hors ligne ne doit plus être lisible.
	onMount(() => {
		forgetOfflinePages(data.space).catch(() => {});
	});

	// Sur téléphone, le pavé de la page remplace le clavier système : sur iOS, un champ
	// mot de passe ignore inputmode et l'autofocus n'ouvre pas le clavier.
	onMount(() => {
		const query = matchMedia('(max-width: 640px)');
		phone = query.matches;
		const onChange = () => (phone = query.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	async function press(digit: string) {
		if (code.length >= CODE_LENGTH) return;
		code += digit;
		if (code.length < CODE_LENGTH) return;
		// Le formulaire lit le champ : attendre que le DOM ait reçu le dernier chiffre.
		await tick();
		formEl.requestSubmit();
	}
</script>

<svelte:head>
	<title>Déverrouiller {SPACE_NAMES[data.space]} · TouteDouceList</title>
</svelte:head>

<main class="unlock">
	<h1>Espace {SPACE_NAMES[data.space]}</h1>

	<form
		method="POST"
		action="?/unlock"
		bind:this={formEl}
		use:enhance={() =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'failure') code = '';
			}}
	>
		<label for="code">Code</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="code"
			class="field code"
			type="password"
			name="code"
			inputmode={phone ? 'none' : 'numeric'}
			pattern="[0-9]*"
			maxlength={CODE_LENGTH}
			autocomplete="off"
			required
			autofocus
			bind:value={code}
		/>
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
		<div class="keypad" role="group" aria-label="Pavé numérique">
			{#each KEYS as key (key)}
				<button class="btn" type="button" onclick={() => press(key)}>{key}</button>
			{/each}
			<button class="btn" type="button" onclick={() => press('0')}>0</button>
			<button
				class="btn ghost"
				type="button"
				aria-label="Effacer"
				onclick={() => (code = code.slice(0, -1))}>⌫</button
			>
		</div>
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

	.keypad {
		display: none;
	}

	@media (max-width: 640px) {
		.unlock {
			margin-top: 8vh;
		}

		.keypad {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 10px;
			margin: 6px 0;
		}

		.keypad .btn {
			min-height: 60px;
			font-size: 1.5rem;
		}

		/* 0 au centre de la dernière ligne. */
		.keypad .btn:nth-last-child(2) {
			grid-column: 2;
		}
	}
</style>
