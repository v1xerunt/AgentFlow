# Install and update the independent Skill

AgentFlow's Skill directory contains its instructions, compiled CLI, examples, setup scripts and licenses. The host session supplies the model and tools. A Node runtime executes the bundled CLI. The Skill's version is the commit that last changed `skills/agentflow` on `main`; `bundle.json` identifies and checksums the matching CLI and every distributed file.

## Install from the repository URL

1. Install for the current host. Use a project installation when the user names a project; otherwise use the host's personal Skill directory. Codex discovers `.agents/skills/agentflow` under a project or the user's home, and its built-in installer may select `$CODEX_HOME/skills/agentflow`. Claude Code uses `.claude/skills/agentflow` under a project or its configuration directory. Preserve the host installer's chosen destination. Inspect existing installations and retain local edits before replacing one.
2. Query `https://api.github.com/repos/v1xerunt/AgentFlow/commits?sha=main&path=skills%2Fagentflow&per_page=1`, read the first commit's `sha`, and download the complete `skills/agentflow` directory at that SHA. For Codex's built-in GitHub Skill installer, use repository `v1xerunt/AgentFlow`, path `skills/agentflow`, and `--ref <sha>`. Keep the CLI, `bundle.json`, references, examples and licenses together. A complete published Skill archive is also usable; retain its `.distribution.json` provenance file.
3. Discover a compatible Node.js **22.13+** executable. In Codex desktop, use its workspace-dependency tool when available to obtain its bundled Node path. The setup scripts also detect system Node. Run the appropriate setup command below, passing the downloaded commit SHA. If neither a host-provided nor system Node is available, the setup script downloads official Node 24 LTS into a dedicated user cache, checks its SHA-256, and keeps the distribution's license files. This dependency is part of the requested Skill setup; follow the host's permission requirements for downloads and writes.
4. The setup script validates the example and writes a launcher with the selected Node's absolute path. Report success only after `valid: true`. Tell the user the Skill location, runtime and invocation (`$agentflow` in Codex, `/agentflow` in Claude Code). Refresh or reopen the host session if it has not discovered the Skill.

Windows PowerShell (omit `-Node` to detect or provision Node):

```powershell
& "<installed skill>/scripts/setup.ps1" -Node "<host Node executable>" -Revision "<sha>"
```

If local PowerShell policy blocks this downloaded script, the host may use a process-scoped execution-policy override for the reviewed script, subject to its permissions; persistent policy settings remain unchanged.

macOS/Linux (omit `--node` to detect or provision Node):

```sh
sh "<installed skill>/scripts/setup.sh" --node "<host Node executable>" --revision "<sha>"
```

Private Node distributions live under `%LOCALAPPDATA%/AgentFlow/runtimes/node` on Windows, or `${XDG_DATA_HOME:-$HOME/.local/share}/agentflow/runtimes/node` on macOS/Linux. Setup keeps system PATH and existing Node installations intact. If a previously selected runtime moves, rerun setup with an available runtime; existing user configuration is retained.

To copy an already downloaded bundle into a host directory, run `<node> "<bundle>/scripts/agentflow.mjs" skill install --host codex --user --revision "<sha>"`. Use `claude` or the requested `--project "<absolute directory>"`. The installer preserves existing destinations.

## Task checks and explicit updates

At the start of each new Skill task, select one fresh task ID and run the installed command with `skill check-update --task "<task-id>"`. Reuse that ID if the check itself must be retried. The script queries only the latest commit affecting `skills/agentflow` on `main`, once per task ID. An unchanged SHA, timeout, rate limit or offline connection produces no output and does not interrupt local work. A changed SHA produces one short update message with a pinned update command. Ordinary Flow commands do not check the network.

When the user requests the update, run `skill update --revision "<sha from the prompt>"`. Omitting `--revision` selects the current directory revision on `main`. The updater verifies Git blob hashes, the complete bundle manifest and a real example CLI invocation in a staging directory. It then replaces the instructions and CLI together. A failed download or validation leaves the installed version usable.

`.agentflow/config.json` stores the selected Node and user configuration. `.agentflow/installation.json` stores the installed directory SHA and CLI build hash. Configuration, task check records, launchers and additional user files survive updates. Local edits to versioned bundle files are detected before replacement; preserve or move those edits before updating. Use `skill status` to inspect the installed SHA and CLI build.

## Source maintenance

Run `npm run skill:sync` after changing the CLI or Skill resources, then include the compiled CLI, licenses and updated `bundle.json` in the same change. `npm run skill:build` verifies the committed bundle against the current CLI build and creates a distributable copy. This makes CLI changes visible to the directory-based update check. Desktop and README-only changes leave the Skill version unchanged.

The [desktop application](https://github.com/v1xerunt/AgentFlow/releases) provides the full interactive editor as a separate installation. Lightweight Skill users can create and execute Flows, save intermediate results, recover runs and export offline HTML panels using their current coding-agent session.
