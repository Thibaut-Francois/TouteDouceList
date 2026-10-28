<script lang="ts">
	import type { TaskCounts } from '$lib/projects';

	let { counts, label }: { counts: TaskCounts; label: string } = $props();

	const percent = $derived(counts.total ? Math.round((counts.done / counts.total) * 100) : 0);
</script>

<div class="progress">
	<div
		class="bar"
		role="progressbar"
		aria-label={label}
		aria-valuemin="0"
		aria-valuemax={counts.total}
		aria-valuenow={counts.done}
		aria-valuetext="{counts.done} sur {counts.total}"
	>
		<span style:width="{percent}%"></span>
	</div>
	<span class="count">{counts.done}/{counts.total}</span>
</div>

<style>
	.progress {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.bar {
		flex: 1;
		height: 6px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--surface-2);
	}

	.bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--success);
	}

	.count {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}
</style>
