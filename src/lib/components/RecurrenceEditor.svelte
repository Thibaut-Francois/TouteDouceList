<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { request } from '$lib/api';
	import { formatFull, todayInParis } from '$lib/dates';
	import { DEFAULT_PRIORITY, PRIORITIES, PRIORITY_LABELS } from '$lib/priorities';
	import {
		defaultPreset,
		INTERVAL_MAX,
		MONTH_LABELS,
		NTH_LABELS,
		NTHS,
		PRESET_KINDS,
		WEEKDAY_LABELS,
		WEEKDAYS,
		type Preset,
		type PresetKind,
		type Weekday
	} from '$lib/recurrence/presets';
	import type { Recurrence, RecurrenceInput } from '$lib/server/repo/recurrences';
	import type { SpaceId } from '$lib/spaces';

	let {
		space,
		recurrence,
		onsave,
		ondelete,
		onclose
	}: {
		space: SpaceId;
		recurrence: Recurrence | null;
		onsave: (input: RecurrenceInput) => Promise<boolean>;
		ondelete: (keepOpen: boolean) => Promise<boolean>;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	const initial = untrack(() => recurrence);
	let title = $state(initial?.title ?? '');
	let notes = $state(initial?.notes ?? '');
	let priority = $state(initial?.priority ?? DEFAULT_PRIORITY);
	let startDate = $state(initial?.startDate ?? todayInParis());
	let preset = $state<Preset>(initial?.preset ?? defaultPreset('weekly', todayInParis()));
	let saving = $state(false);
	let confirmingDelete = $state(false);
	let deleteOpen = $state(true);

	const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	function changeKind(kind: PresetKind) {
		preset = defaultPreset(kind, startDate || todayInParis());
	}

	function toggleDay(day: Weekday) {
		if (preset.kind !== 'custom') return;
		preset.days = preset.days.includes(day) ? preset.days.filter((d) => d !== day) : [...preset.days, day];
	}

	// Aperçu calculé par le serveur (rrule n'est pas envoyé au navigateur).
	let preview = $state<string[]>([]);
	$effect(() => {
		const body = { preset: $state.snapshot(preset), startDate };
		const timer = setTimeout(async () => {
			try {
				const url = `/api/${space}/recurrences/preview`;
				preview = (await request<{ dates: string[] }>('POST', url, body, { delays: [] })).dates;
			} catch {
				preview = [];
			}
		}, 250);
		return () => clearTimeout(timer);
	});

	let dialog: HTMLDialogElement;
	onMount(() => dialog.showModal());

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!title.trim() || saving) return;
		saving = true;
		const ok = await onsave({
			title: title.trim(),
			notes,
			priority,
			preset: $state.snapshot(preset),
			startDate
		});
		saving = false;
		if (ok) dialog.close();
	}

	async function confirmDelete() {
		saving = true;
		const ok = await ondelete(!deleteOpen);
		saving = false;
		if (ok) dialog.close();
	}
</script>

<dialog bind:this={dialog} {onclose} aria-labelledby="{uid}-heading">
	{#if confirmingDelete && initial}
		<div class="confirm">
			<h2 id="{uid}-heading">Supprimer « {initial.title} » ?</h2>
			<p class="muted">
				Plus aucune occurrence ne sera créée. Les occurrences déjà terminées restent dans l'archive.
			</p>
			{#if initial.openCount > 0}
				<label class="check">
					<input type="checkbox" bind:checked={deleteOpen} />
					{initial.openCount === 1
						? 'Supprimer aussi son occurrence en cours'
						: `Supprimer aussi ses ${initial.openCount} occurrences en cours`}
				</label>
			{/if}
			<div class="actions">
				<button class="btn ghost" type="button" onclick={() => (confirmingDelete = false)}>
					Annuler
				</button>
				<button class="btn danger" type="button" disabled={saving} onclick={confirmDelete}>
					Supprimer
				</button>
			</div>
		</div>
	{:else}
		<form onsubmit={submit}>
			<h2 id="{uid}-heading">{initial ? 'Modifier la récurrence' : 'Nouvelle récurrence'}</h2>

			<div class="group">
				<label for="{uid}-title">Titre</label>
				<input id="{uid}-title" class="field" bind:value={title} required maxlength="500" />
			</div>

			<div class="group">
				<label for="{uid}-kind">Rythme</label>
				<select
					id="{uid}-kind"
					class="field"
					value={preset.kind}
					onchange={(e) => changeKind(e.currentTarget.value as PresetKind)}
				>
					{#each PRESET_KINDS as { kind, label } (kind)}
						<option value={kind}>{label}</option>
					{/each}
				</select>
			</div>

			{#if preset.kind === 'weekly'}
				{@const weekly = preset}
				<div class="group">
					<label for="{uid}-day">Jour</label>
					<select id="{uid}-day" class="field" bind:value={weekly.day}>
						{#each WEEKDAYS as d (d)}<option value={d}>{WEEKDAY_LABELS[d]}</option>{/each}
					</select>
				</div>
			{:else if preset.kind === 'monthly-day'}
				{@const monthly = preset}
				<div class="group">
					<label for="{uid}-dom">Jour du mois</label>
					<select id="{uid}-dom" class="field" bind:value={monthly.day}>
						{#each { length: 31 }, i (i)}<option value={i + 1}>{i + 1}</option>{/each}
					</select>
				</div>
				{#if monthly.day > 28}
					<p class="hint">Les mois plus courts, ce sera le dernier jour du mois.</p>
				{/if}
			{:else if preset.kind === 'monthly-nth'}
				{@const nth = preset}
				<div class="row">
					<div class="group">
						<label for="{uid}-nth">Le</label>
						<select id="{uid}-nth" class="field" bind:value={nth.nth}>
							{#each NTHS as n (n)}<option value={n}>{NTH_LABELS[n]}</option>{/each}
						</select>
					</div>
					<div class="group">
						<label for="{uid}-day">Jour</label>
						<select id="{uid}-day" class="field" bind:value={nth.day}>
							{#each WEEKDAYS as d (d)}<option value={d}>{WEEKDAY_LABELS[d]}</option>{/each}
						</select>
					</div>
				</div>
			{:else if preset.kind === 'yearly'}
				{@const yearly = preset}
				<div class="row">
					<div class="group">
						<label for="{uid}-yday">Jour</label>
						<select id="{uid}-yday" class="field" bind:value={yearly.day}>
							{#each { length: DAYS_IN_MONTH[yearly.month - 1] }, i (i)}
								<option value={i + 1}>{i + 1}</option>
							{/each}
						</select>
					</div>
					<div class="group">
						<label for="{uid}-month">Mois</label>
						<select
							id="{uid}-month"
							class="field"
							bind:value={yearly.month}
							onchange={() => (yearly.day = Math.min(yearly.day, DAYS_IN_MONTH[yearly.month - 1]))}
						>
							{#each MONTH_LABELS as m, i (m)}<option value={i + 1}>{m}</option>{/each}
						</select>
					</div>
				</div>
				{#if yearly.month === 2 && yearly.day === 29}
					<p class="hint">Les années non bissextiles, ce sera le 28 février.</p>
				{/if}
			{:else if preset.kind === 'custom'}
				{@const custom = preset}
				<div class="row">
					<div class="group">
						<label for="{uid}-interval">Tous les</label>
						<input
							id="{uid}-interval"
							class="field"
							type="number"
							min="1"
							max={INTERVAL_MAX}
							required
							bind:value={custom.interval}
						/>
					</div>
					<div class="group">
						<label for="{uid}-unit">Unité</label>
						<select id="{uid}-unit" class="field" bind:value={custom.unit}>
							<option value="day">jours</option>
							<option value="week">semaines</option>
							<option value="month">mois</option>
							<option value="year">ans</option>
						</select>
					</div>
				</div>
				{#if custom.unit === 'week'}
					<fieldset class="days">
						<legend>Jours (aucun : le jour de la date de début)</legend>
						{#each WEEKDAYS as d (d)}
							<button
								class="chip"
								type="button"
								aria-pressed={custom.days.includes(d)}
								aria-label={WEEKDAY_LABELS[d]}
								onclick={() => toggleDay(d)}
							>
								{WEEKDAY_LABELS[d].slice(0, 3)}
							</button>
						{/each}
					</fieldset>
				{/if}
			{/if}

			<div class="row">
				<div class="group">
					<label for="{uid}-priority">Priorité</label>
					<select id="{uid}-priority" class="field" bind:value={priority}>
						{#each PRIORITIES as p (p)}<option value={p}>{p} · {PRIORITY_LABELS[p]}</option>{/each}
					</select>
				</div>
				<div class="group">
					<label for="{uid}-start">À partir du</label>
					<input id="{uid}-start" class="field" type="date" required bind:value={startDate} />
				</div>
			</div>

			<div class="group">
				<label for="{uid}-notes">Notes</label>
				<textarea id="{uid}-notes" class="field" bind:value={notes} rows="2" maxlength="10000"></textarea>
			</div>

			<div class="preview" aria-live="polite">
				<span id="{uid}-preview">Prochaines dates</span>
				{#if preview.length}
					<ul aria-labelledby="{uid}-preview">
						{#each preview as date (date)}<li>{formatFull(date)}</li>{/each}
					</ul>
				{:else}
					<p class="muted">Aucune date.</p>
				{/if}
			</div>

			<div class="actions">
				{#if initial}
					<button class="btn ghost danger-text" type="button" onclick={() => (confirmingDelete = true)}>
						Supprimer
					</button>
				{/if}
				<span class="spacer"></span>
				<button class="btn ghost" type="button" onclick={() => dialog.close()}>Annuler</button>
				<button class="btn primary" type="submit" disabled={saving}>Enregistrer</button>
			</div>
		</form>
	{/if}
</dialog>

<style>
	dialog {
		width: min(560px, calc(100vw - 24px));
		max-height: calc(100dvh - 24px);
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		color: var(--text);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}

	form,
	.confirm {
		display: grid;
		gap: 14px;
	}

	h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.group {
		display: grid;
		gap: 6px;
	}

	.group > label,
	legend,
	.preview > span {
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	textarea.field {
		padding: 10px 12px;
		resize: vertical;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.hint {
		margin: -6px 0 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.days {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: none;
	}

	legend {
		width: 100%;
		margin-bottom: 6px;
		padding: 0;
	}

	.chip {
		min-width: 52px;
		min-height: 38px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, var(--surface-2));
	}

	.preview {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--bg);
	}

	.preview ul {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.9rem;
	}

	.preview p {
		margin: 0;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.check input {
		width: 20px;
		height: 20px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.spacer {
		flex: 1;
	}

	.btn.danger {
		border-color: var(--danger);
		background: var(--danger);
		color: var(--accent-text);
		font-weight: 600;
	}

	.danger-text {
		color: var(--danger);
	}

	@media (max-width: 480px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
