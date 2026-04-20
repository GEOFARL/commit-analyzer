# Load & performance scripts

[k6](https://k6.io) scripts that exercise live API instances. They are not run
automatically in `pnpm test` — they expect a real, reachable backend (local
docker stack or staging) and are gated behind the `load` GitHub Actions job
(manual dispatch, see `docs/10-testing.md` §9).

## Phase 2 exit criterion

`sync.k6.ts` enforces the **Phase 2 exit criterion** from
`docs/12-roadmap.md`: connecting a real ~1000-commit repository must finish
within 60 seconds end-to-end. The script's `sync_duration_ms` threshold fails
the run if any single sync exceeds the budget.

### Seeding a fixture repo

Any GitHub repository with ≥ 1000 commits the authenticated user can list will
work. Two reproducible options:

1. **Use a public repo your test account has access to** — fork
   `git/git` (>50k commits) into the test org and set
   `K6_GITHUB_REPO_ID` to its numeric id.
2. **Generate one programmatically** with a script that loops `git commit
   --allow-empty` 1000+ times and pushes to a fresh repo, then OAuth-grants
   the test user.

### Running

```bash
# 1. Boot the API + workers locally (or point at staging).
pnpm dev   # in another terminal

# 2. Mint a fresh JWT for the test user (Supabase admin API or browser cookie).
export K6_AUTH_TOKEN=<jwt>
export K6_GITHUB_REPO_ID=<numeric-id-of-seeded-repo>
export K6_API_BASE_URL=http://localhost:3001

# 3. Run.
k6 run tests/load/sync.k6.ts
```

A passing run prints `sync_duration_ms ........: max=…ms (max<60000 ✓)`.

### Other scripts (planned)

`docs/10-testing.md` §8 lists two more scripts that are not yet implemented:

| Script | Target |
|--------|--------|
| `analytics.k6.ts` | 50 RPS on `/analytics/timeline` for 60 s; p95 < 500 ms uncached, < 100 ms cached |
| `generate.k6.ts` | 10 concurrent generations; TTFT < 2 s p95 |
