# TouteDouceList

To-do list personnelle (un seul utilisateur), installable en PWA, avec deux espaces étanches **Pro** et **Perso** protégés chacun par un mot de passe. Priorité absolue : ouvrir l'app, ajouter et cocher une tâche en quelques secondes.

Le plan complet et validé, phase par phase, est dans `C:\Users\thibf\.claude\plans\quirky-bubbling-cocoa.md`. **Chaque phase est validée par l'utilisateur avant de passer à la suivante. Un commit par étape fonctionnelle.** Ne rien ajouter hors périmètre sans le proposer d'abord (hors périmètre : notifications, emails, rappels, multi-utilisateur, partage, inscription).

## Stack
- SvelteKit 2 + Svelte 5 (runes), TypeScript strict, CSS natif (pas de librairie de composants)
- `@sveltejs/adapter-vercel`, région `cdg1` (Paris)
- Turso (libSQL) + Drizzle ORM ; même driver `@libsql/client` en local (`file:local.db`) et en tests
- `@node-rs/argon2` (argon2id) pour les mots de passe
- `rrule` pour les récurrences (phase 4), **côté serveur uniquement**
- Vitest (unitaires et intégration sur une vraie base SQLite)

Les versions sont épinglées exactement dans `package.json`. Avant toute nouvelle dépendance, choisir une version publiée depuis au moins deux semaines.

## Commandes
```
npm run dev          # serveur de dev (lit .env)
npm test             # Vitest
npm run test:e2e     # Playwright, PC + mobile (Pixel 7) ; base temporaire neuve, serveur de dev sur :4174
npm run check        # svelte-check / TypeScript
npm run build        # build de production
npm run db:generate  # génère une migration SQL après modification de schema.ts
npm run db:migrate   # applique les migrations sur DATABASE_URL
npm run setup        # migrations + création/mise à jour des espaces depuis PASSWORD_PRO / PASSWORD_PERSO
```
Variables d'environnement : voir `.env.example`. Changer un mot de passe via `npm run setup` déconnecte tous les appareils de l'espace.

Sous Windows, `npm run build` échoue à l'étape finale de l'adapter Vercel (création de liens symboliques, `EPERM`), sauf si le mode développeur de Windows est activé. Le build client dans `.svelte-kit/output/client` est quand même produit, et le build Vercel (sous Linux) n'est pas concerné.

## Architecture
- `src/lib/spaces.ts` : identifiants des espaces (`'pro' | 'perso'`) et libellés.
- `src/lib/server/db/schema.ts` : schéma Drizzle. Migrations SQL versionnées dans `drizzle/`.
- `src/lib/server/auth.ts` : sessions, déverrouillage, limitation des tentatives, `requireSpace`.
- `src/lib/server/repo/*.ts` : accès aux données.
- `src/lib/server/validate.ts` : validation des corps JSON des API.
- `src/routes/[space=space]/(app)/` : pages protégées d'un espace. `[space=space]/unlock/` : déverrouillage (action `?/unlock`) et verrouillage (action `?/lock`).
- `src/routes/api/[space=space]/…` : endpoints JSON utilisés pour les mises à jour optimistes.
- `src/hooks.server.ts` : refuse toute requête non-GET dont l'`Origin` diffère (CSRF), injecte `locals.db`.

### Règles d'isolation (à ne jamais contourner)
- Chaque load et chaque endpoint d'un espace commence par `await requireSpace(event, event.params.space)` (avec `{ onLocked: 'redirect' }` pour les pages). Les loads de layout et de page s'exécutent en parallèle : **chaque** load vérifie lui-même l'accès.
- Chaque fonction de `repo/` prend `spaceId` en paramètre obligatoire et filtre sur `space_id` dans le `WHERE`, y compris pour les UPDATE et DELETE par id. Une ressource d'un autre espace donne un 404, jamais une fuite.
- Un cookie de session par espace (`tdl_pro`, `tdl_perso`) : httpOnly, Secure, SameSite=Lax, 180 jours avec prolongation glissante. En base, on ne stocke que le SHA-256 du jeton.
- Tout nouvel endpoint ajoute ses cas dans `tests/isolation.test.ts`.

### Conventions de données
- Dates de tâche : texte `YYYY-MM-DD`, en dates flottantes (sans heure ni fuseau). « Aujourd'hui » se calcule en Europe/Paris.
- Horodatages (`created_at`, `completed_at`, etc.) : millisecondes UTC, en entiers.
- Les ids de tâche sont des UUID générés côté client : la création est idempotente (`ON CONFLICT DO NOTHING`), et la réutilisation d'un id d'un autre espace renvoie 409.
- Priorités : 1 Critique · 2 Élevée · 3 Faible (par défaut) · 4 Minime.

### Décisions produit
- Récurrences : une occurrence non faite **reste en retard** (cumul) ; « le 29/30/31 » est ramené au dernier jour des mois courts (`BYMONTHDAY=N,-1;BYSETPOS=1`) ; les jours ouvrés vont du lundi au vendredi, sans jours fériés. Génération à la demande, idempotente grâce à `UNIQUE(recurrence_id, occurrence_date)`. Une récurrence modifiée ou supprimée ne touche jamais aux occurrences terminées.
- Hors ligne : lecture seule (dernière liste en cache, aucune écriture).
- Synchronisation : rechargement sur `visibilitychange` et sur `online`, sans polling.
- Filtres et tri : mémorisés par espace dans `localStorage`, donc propres à chaque appareil.

## Conventions de code
- Interface, messages et commentaires en français ; identifiants de code en anglais.
- Commentaires rares, réservés au « pourquoi ».
- Indentation par tabulations, guillemets simples (style Prettier par défaut de SvelteKit).
- Performance : moins de ~100 Ko de JS initial gzippé, Lighthouse mobile ≥ 95. Pas de dépendance client lourde ; ce qui peut rester côté serveur y reste.
- Tests : `tests/*.test.ts`. `tests/helpers.ts` fournit `createTestDb`, `seedSpaces`, `fakeEvent` (pour appeler directement un handler) et `statusOf`.
- E2E : `e2e/*.spec.ts`. Attendre l'hydratation (`networkidle`) après chaque navigation ou rechargement, avant d'interagir.

### Interface
- `src/lib/tasks.svelte.ts` (`TaskStore`) : mises à jour optimistes. L'affichage combine la liste du serveur, les créations non confirmées et les modifications en cours ; les opérations d'une même tâche partent dans l'ordre. Une création échouée reste affichée avec « Réessayer » ; une modification échouée est annulée et signalée par un toast.
- `src/lib/api.ts` : réessais (500 ms, 1,5 s, 4 s) sur erreur réseau ou 5xx, jamais sur 4xx. Un 401 renvoie vers le déverrouillage.
- Sur mobile (≤ 640 px), le champ de création est toujours `position: fixed`, ouvert comme fermé, pour ne jamais décaler la liste sous le doigt. Fermé, il reste focusable (pas de `display: none`) pour que le bouton flottant ouvre le clavier dans le même geste.
