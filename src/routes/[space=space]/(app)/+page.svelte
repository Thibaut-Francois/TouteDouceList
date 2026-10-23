<script lang="ts">
	import { SPACE_NAMES } from '$lib/spaces';

	let { data } = $props();
</script>

<svelte:head>
	<title>{SPACE_NAMES[data.space]} · TouteDouceList</title>
</svelte:head>

{#if data.tasks.length === 0}
	<p class="muted">Aucune tâche.</p>
{:else}
	<ul>
		{#each data.tasks as task (task.id)}
			<li>{task.title}</li>
		{/each}
	</ul>
{/if}
