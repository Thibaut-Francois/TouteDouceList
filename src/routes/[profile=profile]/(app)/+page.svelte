<script lang="ts">
	import SpaceTasks from '$lib/components/SpaceTasks.svelte';
	import { PROFILE_NAMES } from '$lib/spaces';

	let { data } = $props();
</script>

<svelte:head>
	<title>{PROFILE_NAMES[data.profile]} · TouteDouceList</title>
</svelte:head>

<!-- Une bascule de profil recrée la liste et son état local. -->
{#key data.profile}
	<SpaceTasks
		scope={{ spaceId: data.space, profileId: data.profile }}
		tasks={data.tasks}
		initialView={data.view}
	/>
{/key}
