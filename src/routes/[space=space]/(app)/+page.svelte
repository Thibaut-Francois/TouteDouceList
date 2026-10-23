<script lang="ts">
	import SpaceTasks from '$lib/components/SpaceTasks.svelte';
	import { SPACE_NAMES } from '$lib/spaces';

	let { data } = $props();
</script>

<svelte:head>
	<title>{SPACE_NAMES[data.space]} · TouteDouceList</title>
</svelte:head>

<!-- Une bascule d'espace recrée la liste et son état local. -->
{#key data.space}
	<SpaceTasks space={data.space} tasks={data.tasks} />
{/key}
