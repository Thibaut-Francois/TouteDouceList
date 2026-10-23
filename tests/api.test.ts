import { describe, expect, it, vi } from 'vitest';
import { ApiError, request } from '$lib/api';

const sleep = vi.fn(async () => {});
const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fetchSequence(...steps: (Response | Error)[]) {
	return vi.fn(async () => {
		const step = steps.shift()!;
		if (step instanceof Error) throw step;
		return step;
	});
}

describe('request', () => {
	it('renvoie le JSON au premier succès', async () => {
		const fetch = fetchSequence(json(201, { id: 'a' }));
		expect(await request('POST', '/x', { a: 1 }, { fetch, sleep })).toEqual({ id: 'a' });
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('réessaie après une erreur réseau ou une 5xx', async () => {
		const fetch = fetchSequence(new TypeError('offline'), json(503, {}), json(200, { ok: true }));
		expect(await request('PATCH', '/x', {}, { fetch, sleep, delays: [1, 1, 1] })).toEqual({
			ok: true
		});
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('abandonne après le dernier réessai', async () => {
		const fetch = fetchSequence(new TypeError('a'), new TypeError('b'), new TypeError('c'));
		await expect(request('POST', '/x', {}, { fetch, sleep, delays: [1, 1] })).rejects.toMatchObject({
			status: 0
		});
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('ne réessaie pas une erreur 4xx et transmet le message', async () => {
		const fetch = fetchSequence(json(401, { message: 'Espace verrouillé' }));
		const error = await request('GET', '/x', undefined, { fetch, sleep }).catch((e) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 401, message: 'Espace verrouillé' });
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('gère les réponses 204', async () => {
		const fetch = fetchSequence(new Response(null, { status: 204 }));
		expect(await request('DELETE', '/x', undefined, { fetch, sleep })).toBeUndefined();
	});
});
