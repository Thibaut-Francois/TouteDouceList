/** Minuscules sans accents : base des recherches insensibles à la casse et aux accents. */
export function foldText(text: string) {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '');
}

/** Contenu de la colonne tasks.search. */
export function searchText(title: string, notes: string) {
	return foldText(`${title} ${notes}`);
}

export function searchWords(query: string) {
	return foldText(query).split(/\s+/).filter(Boolean);
}
