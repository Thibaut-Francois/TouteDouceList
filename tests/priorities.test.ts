import { expect, it } from 'vitest';
import { PRIORITIES, PRIORITY_COLORS } from '$lib/priorities';

// Fonds de src/app.css (--bg, --surface, --surface-2) ; le badge ajoute un voile de sa couleur à 15 %.
const BACKGROUNDS = ['#121316', '#1b1d22', '#24272e'];
const TINT = 0.15;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (fg: number[], bg: number[], alpha: number) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

function luminance([r, g, b]: number[]) {
	const [R, G, B] = [r, g, b].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a: number[], b: number[]) {
	const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (l1 + 0.05) / (l2 + 0.05);
}

it.each(PRIORITIES.flatMap((p) => BACKGROUNDS.map((bg) => [p, bg] as const)))(
	'priorité %i lisible (AA, 4,5:1) sur %s',
	(priority, bg) => {
		const color = rgb(PRIORITY_COLORS[priority]);
		const badgeBg = mix(color, rgb(bg), TINT);
		expect(contrast(color, badgeBg)).toBeGreaterThanOrEqual(4.5);
	}
);
