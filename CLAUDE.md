# TouteDouceList

To-do list personnelle (un seul utilisateur), installable en PWA, avec deux espaces étanches **Pro** et **Perso**. L'app s'ouvre sur Pro (`/` redirige vers `/pro`). **Perso est caché** : aucun lien n'y mène, on y entre en tapant `/perso` (l'en-tête de Perso garde un lien vers Pro). **Pro est en accès libre** (choix assumé de l'utilisateur, en sachant que quiconque a l'adresse du site peut l'ouvrir) ; **Perso** se déverrouille avec le **code du jour** : mois puis jour, heure de Paris (23/10 → `1023`), vérifié côté serveur. Priorité absolue : ouvrir l'app, ajouter et cocher une tâche en quelques secondes.

Le plan complet et validé, phase par phase, est dans `C:\Users\thibf\.claude\plans\quirky-bubbling-cocoa.md`. **Chaque phase est validée par l'utilisateur avant de passer à la suivante. Un commit par étape fonctionnelle.** Ne rien ajouter hors périmètre sans le proposer d'abord (hors périmètre : notifications, emails, rappels, multi-utilisateur, partage, inscription).

## Stack
- SvelteKit 2 + Svelte 5 (runes), TypeScript strict, CSS natif (pas de librairie de composants)
- `@sveltejs/adapter-vercel`, région `cdg1` (Paris)
- Turso (libSQL) + Drizzle ORM ; même driver `@libsql/client` en local (`file:local.db`) et en tests
- `rrule` pour les récurrences (phase 4), **côté serveur uniquement**
- Vitest (unitaires et intégration sur une vraie base SQLite)

Les versions sont épinglées exactement dans `package.json`. Avant toute nouvelle dépendance, choisir une version publiée depuis au moins deux semaines.

## Commandes
```
npm run dev          # serveur de dev (lit .env)
npm test             # Vitest
npm run test:e2e     # Playwright : PC + mobile sur le serveur de dev (:4174), PWA/hors ligne sur un build de production (:4175)
npm run check        # svelte-check / TypeScript
npm run build        # build de production
npm run db:generate  # génère une migration SQL après modification de schema.ts
npm run db:migrate   # applique les migrations sur DATABASE_URL
npm run setup        # migrations + création des deux espaces s'ils manquent
npm run setup:prod   # idem sur la base Turso, à partir de .env.production (jamais commité, jamais lu par Claude)
```
Variables d'environnement : voir `.env.example` (base de données uniquement ; aucun mot de passe à configurer).

Sous Windows, `npm run build` échoue à l'étape finale de l'adapter Vercel (création de liens symboliques, `EPERM`), sauf si le mode développeur de Windows est activé. Le build client dans `.svelte-kit/output/client` est quand même produit, et le build Vercel (sous Linux) n'est pas concerné. Avec `E2E_PREVIEW=1`, `svelte.config.js` utilise l'adapter Node : le build réussit et `vite preview` sert le build de production (tests PWA, Lighthouse).

## Déploiement
- Production : **https://toute-douce-list.vercel.app**. Les adresses propres à chaque déploiement (`toute-douce-list-<hash>-….vercel.app`) sont protégées par la connexion Vercel : vérifier sur l'adresse de production.
- Vercel (Hobby) relié au dépôt GitHub : chaque push sur `main` déploie. Région des fonctions `cdg1`. Variables Vercel : `DATABASE_URL` (`libsql://…turso.io`) et `DATABASE_AUTH_TOKEN` ; après une modification, redéployer pour qu'elles s'appliquent.
- Turso : base `toutedoucelist` en `aws-eu-west-1`, gérée depuis app.turso.tech (pas de CLI Turso sous Windows). Après une nouvelle migration, lancer `npm run setup:prod` **avant** de pousser le code qui en dépend (sinon erreur 500 sur les pages qui lisent les tables).
- Les commandes que l'utilisateur lance avec `!` passent par Bash : chemins avec des `/` (`cd /c/Users/thibf/Documents/TouteDouceList && …`).
- Lighthouse : lancer la CLI avec Node et `CHROME_PATH` pointant vers le Chromium de Playwright, avec `--chrome-flags=--headless=new --no-sandbox`. Via `npx`, sous Windows, Chrome ne démarre pas. Page connectée : `--extra-headers=<fichier JSON {"Cookie":"tdl_perso=…"}>`.

## PWA et hors ligne
- `static/manifest.webmanifest`, icônes dans `static/icons/` (générées avec System.Drawing ; la maskable garde le motif dans la zone sûre de 80 %).
- `src/service-worker.ts` : précache des assets versionnés (`build` + `files`). Pages d'espace et `__data.json` en réseau d'abord, la dernière réponse 200 non redirigée étant conservée dans le cache `tdl-pages` (`isCachablePage`, `src/lib/offline.ts`). Jamais l'API ni `/unlock`. Hors ligne, `/` (start_url) redirige vers `/pro`, qui sert sa copie.
- Hors ligne (`network.offline`, `src/lib/network.svelte.ts`) : bandeau, champ de création et cases désactivés ; `TaskStore` et les pages refusent toute écriture avec un toast.
- Le verrouillage, et l'affichage de la page de déverrouillage (session expirée), effacent la copie hors ligne de l'espace (`forgetOfflinePages`).

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
- Accès : `isProtected(space)` (`src/lib/spaces.ts`), vrai pour Perso seulement. `requireSpace` laisse passer Pro sans session et exige une session pour Perso.
- Chaque load et chaque endpoint d'un espace commence par `await requireSpace(event, event.params.space)` (avec `{ onLocked: 'redirect' }` pour les pages). Les loads de layout et de page s'exécutent en parallèle : **chaque** load vérifie lui-même l'accès.
- Chaque fonction de `repo/` prend `spaceId` en paramètre obligatoire et filtre sur `space_id` dans le `WHERE`, y compris pour les UPDATE et DELETE par id. Une ressource d'un autre espace donne un 404, jamais une fuite. **C'est ce qui empêche l'API Pro, ouverte à tous, d'atteindre une donnée Perso.**
- Code du jour : `dailyCode()` dans `auth.ts`, comparé en temps constant, avec la limitation des tentatives (5 échecs par IP sur 15 min, 20 par heure pour l'espace). Session Perso : cookie `tdl_perso` httpOnly, Secure, SameSite=Lax, 180 jours avec prolongation glissante ; en base, on ne stocke que le SHA-256 du jeton. « Verrouiller » n'existe que pour Perso et renvoie sur Pro.
- Tout nouvel endpoint ajoute ses cas dans `tests/isolation.test.ts` : refus pour un visiteur sans session côté Perso, 404 entre espaces dans les deux sens.

### Conventions de données
- Dates de tâche : texte `YYYY-MM-DD`, en dates flottantes (sans heure ni fuseau). « Aujourd'hui » se calcule en Europe/Paris.
- Affichage d'une date de tâche (ou d'étape) : **toujours** `formatTaskDate` (`src/lib/dates.ts`). « hier », « aujourd'hui », « demain », « après-demain » seulement si la date est dans la semaine en cours (lundi → dimanche), sinon `jj/mm/aaaa` ; `{ capitalize: true }` pour un libellé seul. La date complète va dans `title` (`formatDateTitle`). Côté interface, « aujourd'hui » vient de `today.value` (`src/lib/today.svelte.ts`), recalculé au retour au premier plan (app restée ouverte après minuit). `formatInstant` reste réservé aux horodatages (créée le, terminée le).
- Horodatages (`created_at`, `completed_at`, etc.) : millisecondes UTC, en entiers.
- Les ids de tâche sont des UUID générés côté client : la création est idempotente (`ON CONFLICT DO NOTHING`), et la réutilisation d'un id d'un autre espace renvoie 409.
- Priorités : 1 Critique · 2 Élevée · 3 Faible (par défaut) · 4 Minime.

### Décisions produit
- Récurrences : une occurrence non faite **reste en retard** (cumul) ; « le 29/30/31 » est ramené au dernier jour des mois courts (`BYMONTHDAY=N,-1;BYSETPOS=1`), de même que « chaque année le 29 février » ; les jours ouvrés vont du lundi au vendredi, sans jours fériés. Génération à la demande, idempotente grâce à `UNIQUE(recurrence_id, occurrence_date)`. Une récurrence modifiée ou supprimée ne touche jamais aux occurrences terminées.
  - `src/lib/recurrence/presets.ts` (partagé, sans dépendance) : préréglage → RRULE, libellés, validation. Le client envoie un **préréglage**, et le serveur en recalcule la RRULE (colonne `rrule`) ; le préréglage est stocké en JSON (colonne `preset`) pour rouvrir le formulaire.
  - `src/lib/server/recurrence/engine.ts` : seul module qui importe `rrule` (côté serveur uniquement ; l'aperçu passe par `POST /api/<espace>/recurrences/preview`). `vite.config.ts` déclare `ssr.noExternal: ['rrule']`, car son point d'entrée Node est en CommonJS.
  - `generate.ts` : appelé par le load de la liste. Les modifications de titre, notes et priorité sont reportées sur les occurrences ouvertes ; une nouvelle règle ne vaut que pour les dates pas encore générées ; la reprise après une pause ne rattrape pas la pause.
  - Suppression : logique (`deleted_at`), elle retire les occurrences ouvertes sauf avec `?occurrences=keep`.
- Archive : tâches `done`, triées par `completed_at` décroissant, regroupées par jour de complétion (heure de Paris). Recherche côté serveur sur la colonne `tasks.search` (titre + notes passés par `searchText`, `src/lib/text.ts`), **à maintenir à chaque écriture de titre ou de notes**. Cette colonne n'est jamais renvoyée au client (`columns` dans `repo/tasks.ts`). Pagination par curseur `completedAt:id` (`/api/<espace>/archive?q=&after=`). La recherche est dans l'URL (`?q=`). La suppression définitive demande une confirmation dans la ligne.
- Hors ligne : lecture seule (dernière liste en cache, aucune écriture).
- Synchronisation : rechargement sur `visibilitychange` et sur `online`, sans polling.
- Filtres et tri : mémorisés par espace et par appareil dans un cookie (`tdl_view_<espace>`, `src/lib/view-cookie.ts`), lu au rendu serveur pour éviter un affichage non filtré. La recherche texte n'est pas mémorisée. Logique de filtrage dans `src/lib/filters.ts`, appliquée côté client sur la liste ouverte.
- Priorités : badge avec le chiffre (l'information ne repose pas sur la couleur seule). Couleurs dans `src/lib/priorities.ts`, contraste AA vérifié par `tests/priorities.test.ts`.
- E2E : ne jamais saisir de mauvais code Perso (le limiteur bloquerait l'IP de test pour les autres tests). `e2e/helpers.ts` fournit `todayCode`, `unlockPerso` et `openPro`. Workers limités à 2 (au-delà, saturation et délais dépassés).
- Fenêtres modales : `<dialog class="modal" use:lightDismiss>` avec un contenu `.modal-body` (`src/app.css`) ; un clic sur le fond ferme sans enregistrer. Sur écran tactile (`pointer: coarse`), la fenêtre de modification d'une tâche prend le focus elle-même (`tabindex="-1"`), pour ne pas ouvrir le clavier sur le titre. Le panneau de filtres flotte au-dessus de la liste, avec un fond invisible qui capte le clic extérieur (le ferme sans rien déclencher dessous) ; Échap le ferme aussi.
- Création : sélecteur d'urgence 1 à 4 à côté du champ (`pointerdown` sans défaut pour garder le focus), remis à « Faible » après chaque création ; la syntaxe `!n` l'emporte.

## Conventions de code
- Interface, messages et commentaires en français ; identifiants de code en anglais.
- Commentaires rares, réservés au « pourquoi ».
- Indentation par tabulations, guillemets simples (style Prettier par défaut de SvelteKit).
- Performance : moins de ~100 Ko de JS initial gzippé, Lighthouse mobile ≥ 95. Pas de dépendance client lourde ; ce qui peut rester côté serveur y reste.
- Tests : `tests/*.test.ts`. `tests/helpers.ts` fournit `createTestDb`, `seedSpaces`, `fakeEvent` (pour appeler directement un handler) et `statusOf`.
- E2E : `e2e/*.spec.ts`. Attendre l'hydratation (`networkidle`) après chaque navigation ou rechargement, avant d'interagir. Avant un rechargement, attendre la réponse de l'écriture en cours (`saved()` dans `e2e/tasks.spec.ts`), sinon le rechargement l'annule. Le premier run après un changement de dépendances ou de `vite.config.ts` peut échouer pendant que Vite réoptimise : relancer.
- Formulaires : labels associés par `for`/`id` (`$props.id()`), jamais en enveloppant un `<select>` (son nom accessible inclurait le texte des options).
- Une liste modifiée localement après un appel d'API part d'un `$derived(data.x)` réassignable, jamais d'une mutation de `data`.

### Interface
- `src/lib/tasks.svelte.ts` (`TaskStore`) : mises à jour optimistes. L'affichage combine la liste du serveur, les créations non confirmées et les modifications en cours ; les opérations d'une même tâche partent dans l'ordre. Une création échouée reste affichée avec « Réessayer » ; une modification échouée est annulée et signalée par un toast.
- `src/lib/api.ts` : réessais (500 ms, 1,5 s, 4 s) sur erreur réseau ou 5xx, jamais sur 4xx. Un 401 renvoie vers le déverrouillage.
- Déverrouillage de Perso sur mobile (≤ 640 px) : pavé numérique dans la page (le champ passe en `inputmode="none"`, car iOS ignore `inputmode` sur un champ mot de passe). Envoi automatique au 4ᵉ chiffre, après `tick()` pour que le champ contienne déjà le chiffre.
- Sur mobile (≤ 640 px), le champ de création est toujours `position: fixed`, ouvert comme fermé, pour ne jamais décaler la liste sous le doigt. Fermé, il reste focusable (pas de `display: none`) pour que le bouton flottant ouvre le clavier dans le même geste.
