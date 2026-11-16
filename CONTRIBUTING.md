# Contributing to SpaceTerm Mobile

Thanks for your interest in SpaceTerm Mobile. The app is in early development, so its shape is still changing. Before you start on anything large, open an issue so we can agree on the approach first.

## Set up

Follow [Develop](README.md#develop) in the README.

## Make a change

1. Branch from `main` and name the branch `<type>/<short-description>`, for example `feat/machine-list` or `fix/pairing-timeout`.
2. Keep each pull request to one change.
3. Run the checks:

   ```sh
   pnpm fmt:check
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

   The Git hooks run them too: formatting and linting on commit, type checking and tests on push.

4. Open a pull request against `main`. Pull requests are squash-merged.

## Commit messages

Write commit messages as [Conventional Commits](https://www.conventionalcommits.org), for example `feat: add the Machine list` or `fix: reconnect after a network change`. commitlint checks every message when you commit.

## Code

[AGENTS.md](AGENTS.md) describes how the code is organized: feature folders, thin routes, and native terminal rendering. It is written for coding agents, and it applies to people too.

## License

By contributing, you agree that your contributions are licensed under the [GNU GPL v3](LICENSE).
