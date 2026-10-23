<script lang="ts" module>
	export type ToastMessage = { message: string; action?: { label: string; run: () => void } };
</script>

<script lang="ts">
	let { toast, ondismiss }: { toast: ToastMessage | null; ondismiss: () => void } = $props();
</script>

<!-- Conteneur toujours présent : les lecteurs d'écran n'annoncent que les zones live déjà dans le DOM. -->
<div class="region" role="status" aria-live="polite">
	{#if toast}
		<div class="toast">
			<span class="message">{toast.message}</span>
			{#if toast.action}
				{@const action = toast.action}
				<button
					class="btn ghost"
					type="button"
					onclick={() => {
						action.run();
						ondismiss();
					}}
				>
					{action.label}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.region {
		position: fixed;
		left: 50%;
		bottom: calc(20px + env(safe-area-inset-bottom));
		z-index: 30;
		width: min(480px, calc(100vw - 32px));
		transform: translateX(-50%);
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 6px 6px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
		pointer-events: auto;
	}

	.message {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn {
		flex: none;
		color: var(--accent);
		font-weight: 600;
	}

	@media (max-width: 640px) {
		/* Laisse la place au bouton flottant. */
		.region {
			left: 16px;
			width: calc(100vw - 112px);
			transform: none;
		}
	}
</style>
