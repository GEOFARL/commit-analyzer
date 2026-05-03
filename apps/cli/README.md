# git-insight-cli

AI-assisted CLI for generating commit messages and PR summaries from local git diffs.

## Install

```bash
npm i -g git-insight-cli
```

Requires Node.js 20+.

## Usage

```bash
git-insight-cli --help
git-insight-cli generate           # generate a commit message from staged changes
git-insight-cli generate --pr      # generate a PR summary from the current branch
```

`git-insight` is also available as an alias for `git-insight-cli`.

## Configuration

The CLI reads `.git-insightrc` (JSON, YAML, or JS) from the repo root or any parent directory. See [project docs](https://github.com/GEOFARL/commit-analyzer) for the full schema.

## License

MIT
