/**
 * Ferme un <dialog> modal quand on clique sur son fond (en dehors du contenu).
 * Le dialog ne doit pas avoir de padding : son contenu le remplit, si bien qu'un clic
 * dont la cible est le dialog lui-même tombe forcément sur le fond.
 * Le clic doit commencer ET finir sur le fond : une sélection de texte glissée hors
 * d'un champ ne ferme rien.
 */
export function lightDismiss(dialog: HTMLDialogElement) {
	let startedOnBackdrop = false;

	const onPointerDown = (event: PointerEvent) => {
		startedOnBackdrop = event.target === dialog;
	};
	const onClick = (event: MouseEvent) => {
		if (startedOnBackdrop && event.target === dialog) dialog.close();
		startedOnBackdrop = false;
	};

	dialog.addEventListener('pointerdown', onPointerDown);
	dialog.addEventListener('click', onClick);
	return {
		destroy() {
			dialog.removeEventListener('pointerdown', onPointerDown);
			dialog.removeEventListener('click', onClick);
		}
	};
}
