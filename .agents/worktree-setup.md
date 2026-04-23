# Worktree setup

Every feature / spike gets its own git worktree sibling so multiple agents (or humans, or both) can iterate without port / DB collisions.

## Layout

```
/Users/kashif/Development/SPP/
├── SeePlusPlus/                    # main clone (this repo).
├── SeePlusPlus-spike-flip/         # sibling worktree for P1a
├── SeePlusPlus-spike-recognition/  # sibling worktree for P1b
├── SeePlusPlus-<feature>/          # any other feature branch
```

Worktrees are **siblings of the main clone**, not nested inside it. Name them `SeePlusPlus-<slug>` where `<slug>` matches the branch / feature.

## Create a worktree

From the main clone:

```bash
# From /Users/kashif/Development/SPP/SeePlusPlus
git worktree add ../SeePlusPlus-<slug> -b <branch-name>
cd ../SeePlusPlus-<slug>

# Assign deterministic ports and DB name based on worktree slug
./scripts/worktree-ports.sh <slug>   # writes .env.local

# Bring up the stack
./localdev.sh up
```

`scripts/worktree-ports.sh` hashes `<slug>` into the 3000/4000 range and writes `.env.local` with:

- `BACKEND_PORT`
- `FRONTEND_PORT`
- `DB_PORT`
- `DB_NAME=seepp_<slug>`

`.env.local` is gitignored. `docker-compose.yml` reads these vars (via `localdev.sh`'s `--env-file .env.local`), so two worktrees up at once don't collide.

## Tear down

```bash
# From the main clone
git worktree remove ../SeePlusPlus-<slug>

# Then drop the DB if you want (otherwise next worktree with the same slug reuses it):
docker volume rm seepp_<slug>_data    # name depends on compose file; check once it's written
```

## Dos and don'ts

- **Do** use a descriptive slug (`auth`, `share-links`, `spike-flip`). Short and kebab-case.
- **Don't** edit `.env.local` by hand to pick your own ports — the script exists so two worktrees never pick the same pair.
- **Do** run `npm install` inside `backend/` once per worktree. Frontend lands at P3 and gets its own install step.
- **Don't** nest worktrees inside `SeePlusPlus/`. Git allows it but it confuses path-resolution in Claude's working-directory model.

## Inspecting the worktree env

Run `cat .env.local` in any worktree to see its assigned ports and DB name. No session-boot hook — keep it simple.
