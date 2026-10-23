<script lang="ts">
	import { PRIORITY_COLORS, PRIORITY_LABELS } from '$lib/priorities';

	let { priority }: { priority: number } = $props();

	const label = $derived(`Priorité ${priority} · ${PRIORITY_LABELS[priority]}`);
</script>

<!-- Le chiffre porte l'information, la couleur ne fait que la renforcer. -->
<span class="badge" style:--c={PRIORITY_COLORS[priority]} role="img" aria-label={label} title={label}>
	{priority}
</span>

<style>
	.badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.5em;
		height: 1.5em;
		padding: 0 0.35em;
		border-radius: 5px;
		background: color-mix(in srgb, var(--c) 15%, transparent);
		color: var(--c);
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1;
	}
</style>
