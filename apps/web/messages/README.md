# i18n messages

Translation catalogs for `@commit-analyzer/web`. Managed by
[next-intl](https://next-intl.dev/).

## Layout

```
messages/
├── en/
│   ├── common.json
│   ├── nav.json
│   ├── landing.json
│   ├── login.json
│   ├── dashboard.json
│   ├── auth.json
│   ├── userMenu.json
│   ├── repositories.json
│   └── errors.json
└── uk/
    └── (same set — parity enforced)
```

Each JSON file is exactly one top-level namespace. The filename IS the
namespace: `useTranslations("repositories")` loads keys from
`repositories.json`. There is no intermediate `{ "repositories": { ... } }`
wrapper inside the file — the file itself is the namespace object.

## Adding a new namespace

1. Create `messages/en/<namespace>.json` — this is the source of truth.
2. Create `messages/uk/<namespace>.json` with the same key shape.
3. Use it: `const t = useTranslations("<namespace>")`.

The custom `local-i18n/namespace-match` ESLint rule rejects
`useTranslations`/`getTranslations` calls whose first argument does not match
an existing file under `messages/en/`, catching typos at lint time. It
supports both the string form (`useTranslations("repositories")`) and the
server-side object form (`getTranslations({ locale, namespace: "repositories" })`).

The rule reads the namespace list from `messages/en/` once at module load,
so if you add a new namespace **while an ESLint daemon is running** (IDE
integration), restart the daemon to pick it up. A fresh `pnpm lint` always
sees the latest list.

## Adding a new locale

1. Add the locale code to `apps/web/src/i18n/routing.ts`.
2. Create `messages/<locale>/` and translate every file that exists under
   `messages/en/`. The parity check in `scripts/check-messages.mjs` fails CI
   on any missing file or drifted key.

## Parity check

`pnpm --filter @commit-analyzer/web test` runs
`scripts/check-messages.mjs`, which walks every locale directory and compares
each file pair against `en/`. Errors point to the exact file and key:

```
uk/repositories.json drift:
  missing: badge.archived
```

## Loader

`src/i18n/request.ts` reads every `*.json` file from
`messages/<locale>/` at request time, merges them into a single object keyed
by filename, and hands that to next-intl. Duplicate namespace keys throw.
Results are cached per locale so disk I/O happens once per process per
locale.

## Literal strings in TSX

The `i18next/no-literal-string` rule is set to **error** in
`src/app/**/*.{ts,tsx}` and `src/components/layout/**/*.{ts,tsx}` — user-
visible surfaces must go through `t(...)`. It stays at **warn** for UI
primitives under `src/components/ui/**`, where `sr-only` labels and similar
are allowed.
