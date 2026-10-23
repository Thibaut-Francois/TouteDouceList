import { hash, verify } from '@node-rs/argon2';

// Argon2id (algorithme par défaut de @node-rs/argon2), paramètres minimaux recommandés par l'OWASP.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const PASSWORD_MAX_LENGTH = 1024;

export function hashPassword(password: string) {
	return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
	if (password.length === 0 || password.length > PASSWORD_MAX_LENGTH) return false;
	try {
		return await verify(passwordHash, password);
	} catch {
		return false;
	}
}
