# Contributing to IncidentPulse

Thanks for your interest in improving IncidentPulse! Contributions of all sizes are welcome—from typo fixes to new integrations. This guide explains how to work with the codebase and submit changes smoothly.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, inclusive, and focus on the work rather than the person.

## Getting Started

1. **Fork and clone**
   ```bash
   git clone https://github.com/<your-handle>/IncidentPulse.git
   cd IncidentPulse
   git remote add upstream https://github.com/bhoyee/IncidentPulse.git
   ```
2. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. **Copy environment variables**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.local.example frontend/.env.local
   ```
   Fill in the values (see README for details). Use dummy secrets in development.
4. **Run services**
   ```bash
   docker compose up postgres -d
   cd backend && npx prisma migrate deploy && npm run dev
   cd ../frontend && npm run dev
   ```

## Branching & Commits

- Use topic branches from `main` (`feat/add-webhook-template`, `fix/status-page-crash`, etc.).
- Keep commits focused and descriptive. Use present tense (“Add Slack notification”) and mention related issues (`Fixes #123`).
- Rebase on top of `main` before opening a PR to avoid merge conflicts.

## Testing Checklist

Before submitting a PR, run:

| Scope     | Command                |
|-----------|------------------------|
| Backend   | `npm run lint`         |
| Backend   | `npm run build`        |
| Backend   | `npm test`             |
| Frontend  | `npm run lint`         |
| Frontend  | `npm run build`        |
| Frontend  | `npm run test:e2e` (optional but encouraged) |

Add or update tests when changing behavior. For UI changes, include screenshots/GIFs in the PR.

## Pull Request Guidelines

- Fill in the PR template (or describe the change, motivation, and testing steps).
- Link the issue you’re addressing (`Closes #123`).
- Mention reviewers if the change touches sensitive areas (auth, migrations, infra).
- Keep PRs focused; large multi-topic PRs are harder to review.

## Database & Migrations

- Use Prisma migrations (`npx prisma migrate dev --name your_change`).
- Commit the generated SQL under `backend/prisma/migrations/`.
- Document breaking schema changes in the PR summary and README if needed.

## Discussions & Support

- Questions/ideas: [GitHub Discussions](https://github.com/bhoyee/IncidentPulse/discussions)
- Bugs/feature requests: [GitHub Issues](https://github.com/bhoyee/IncidentPulse/issues)

## Release Process

Maintainers:
- Merge PRs via squash or rebase to keep history clean.
- Tag releases (`git tag v0.x.y && git push --tags`).
- Update the changelog/README with highlights.

Thanks again for contributing—your improvements make IncidentPulse better for everyone!
