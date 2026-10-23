export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

type Options = {
	fetch?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
	/** Délais entre les tentatives : autant de réessais que d'éléments. */
	delays?: number[];
};

const DELAYS = [500, 1500, 4000];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function messageOf(res: Response) {
	try {
		const body = await res.json();
		return typeof body?.message === 'string' ? body.message : res.statusText;
	} catch {
		return res.statusText;
	}
}

/**
 * Requête JSON, réessayée en cas d'erreur réseau ou serveur (5xx).
 * Les erreurs 4xx sont définitives. Les endpoints sont idempotents, donc réessayer est sans risque.
 */
export async function request<T>(
	method: string,
	url: string,
	body?: unknown,
	{ fetch: doFetch = fetch, sleep = wait, delays = DELAYS }: Options = {}
): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		let res: Response | undefined;
		try {
			res = await doFetch(url, {
				method,
				headers: body === undefined ? undefined : { 'content-type': 'application/json' },
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		} catch {
			// Erreur réseau : on réessaie.
		}
		if (res?.ok) return (res.status === 204 ? undefined : await res.json()) as T;

		const retryable = res === undefined || res.status >= 500;
		if (!retryable || attempt >= delays.length) {
			throw new ApiError(res?.status ?? 0, res ? await messageOf(res) : 'Réseau indisponible');
		}
		await sleep(delays[attempt]);
	}
}
