# Contributing to ClarioDesk

Thank you for your interest in contributing! ClarioDesk is built by the community for the community.

## Ways to contribute

- **Bug reports** — open an [issue](https://github.com/varaprasadreddy9676/clariodesk/issues/new?template=bug_report.md)
- **Feature requests** — open an [issue](https://github.com/varaprasadreddy9676/clariodesk/issues/new?template=feature_request.md)
- **Code** — fix a bug, implement a feature, improve tests
- **Documentation** — improve the README, add inline docs, write guides
- **Translations** — help make ClarioDesk accessible in more languages

## Before you start

For anything beyond a small bug fix, **open an issue first** so we can:
- Confirm it's in scope for the project
- Avoid duplicate work
- Align on the approach before you invest time coding

## Development setup

See the [Quick Start](README.md#-quick-start) in the README. All you need is Node 20+ and Docker.

```bash
git clone https://github.com/varaprasadreddy9676/clariodesk.git
cd clariodesk
npm install
npm run dev:infra
cp .env.example .env
npm run db:migrate
```

## Workflow

1. **Fork** the repository and clone your fork
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/the-bug-you-are-fixing
   ```
3. **Make your changes** — follow the code style guide below
4. **Write or update tests** — we aim for 80%+ coverage on new code
5. **Verify everything passes:**
   ```bash
   npx tsc --build --pretty    # type check
   npx vitest run              # unit tests
   npm run lint                # linting
   npm run format:check        # formatting
   ```
6. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add broadcast campaign support
   fix: prevent double-send on BullMQ stall
   docs: add self-hosting guide
   ```
7. **Push** and open a Pull Request against `main`

## Code style

- **TypeScript everywhere** — no `any`, use `unknown` for external data
- **Immutable patterns** — never mutate objects in place, return new copies
- **Small files** — aim for 200–400 lines; extract when files grow beyond 800
- **No comments that restate the code** — only comment the *why* when it's non-obvious
- **Error handling** — always handle errors; never swallow them silently
- **Zod for validation** — all external input (API requests, env vars) validated with Zod

Format with Prettier before pushing:
```bash
npm run format
```

## Pull Request guidelines

- Keep PRs focused — one feature or fix per PR
- Explain *why* in the PR description, not just what
- Reference the issue it resolves: `Closes #123`
- Screenshots or a short video are very helpful for UI changes
- All CI checks must pass before review

## Testing

| Type | Command | When required |
|------|---------|---------------|
| Unit | `npx vitest run` | Always |
| Integration | `npm run test:integration` | For DB / API changes |
| Type check | `npx tsc --build` | Always |

Integration tests use Testcontainers — they spin up a real Postgres instance. They take ~30s and require Docker.

## Project structure

```
apps/          Runtime services (api, gateway, realtime, worker, scheduler, web)
packages/      Shared libraries (db, config, policy-engine, etc.)
deploy/        Docker Compose + Dockerfile for production
docs/          Architecture and specs
```

See the [Architecture section](README.md#-architecture) in the README for a full overview.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

## Code of Conduct

By participating, you agree to our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to making ClarioDesk a welcoming community.

## License

By submitting a contribution, you agree that it will be licensed under the project's [AGPL-3.0 license](LICENSE).
