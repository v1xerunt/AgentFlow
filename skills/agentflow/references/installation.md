# Install AgentFlow for a coding agent

Use this procedure when a user asks to install this repository as a Skill, or when a copied Skill is missing its compiled CLI. A successful installation includes a working command and a validated example Flow.

## Select the host and destination

Install for the current host. Use a project installation when the user names a project; otherwise use that host's personal Skill directory. Codex discovers `.agents/skills/agentflow` under a project or the user's home; its built-in installer may select `$CODEX_HOME/skills/agentflow`. Claude Code uses `.claude/skills/agentflow` under a project or its configuration directory. Preserve the destination selected by the host's installer. Check for existing personal and project installations before creating another copy; preserve local edits and resolve an update with the user.

## Reuse an installed desktop application

Use local filesystem tools to check conventional locations and any user-specified application path. Availability in a cloud container only describes that container; it does not establish what is installed on the user's computer.

| Platform | Where to look for the bundled command |
| --- | --- |
| Windows | `<AgentFlow install directory>/resources/agentflow/agentflow.cmd`. Check `%LOCALAPPDATA%/Programs/AgentFlow`, `%LOCALAPPDATA%/Programs/agentflow`, then the `AgentFlow` uninstall registry entry for a custom location. |
| macOS | `/Applications/AgentFlow.app/Contents/Resources/agentflow/agentflow`, or the equivalent under `~/Applications`. |
| Linux package | `/opt/AgentFlow/resources/agentflow/agentflow` or `/opt/agentflow/resources/agentflow/agentflow`. Check the installed package file list for a custom location. |

Validate a candidate by running its `--version` and `skill install --help`. Older desktop releases may lack this command; continue with the lightweight package in that case. Avoid launching the GUI just to detect installation.

Run the discovered command with `skill install --host codex --user`, or replace `--user` with `--project "<absolute directory>"`. Use `claude` for Claude Code. The installer copies the complete Skill and writes a launcher that calls the installed application in Node mode. It works when the GUI is closed and needs no separate Node installation. For a destination already created by the host's Skill installer, install into a temporary project first, then transfer the complete bundle to that approved destination, preserving any user changes.

An AppImage can be called in Node mode directly, without a permanent extraction or a running GUI. Replace the first path and append the desired CLI arguments:

```sh
ELECTRON_RUN_AS_NODE=1 "/absolute/AgentFlow.AppImage" --eval 'const p=require("node:path");const f=p.join(p.dirname(process.execPath),"resources/agentflow/cli/index.js");process.argv.splice(1,0,f);import(require("node:url").pathToFileURL(f).href)' -- skill install --host codex --user
```

## Install the lightweight package

1. Get the latest published, non-prerelease release from `https://api.github.com/repos/v1xerunt/AgentFlow/releases/latest`. Download its `AgentFlow-<version>-skill.tar.gz` and `SHA256SUMS.txt` from the official release assets. Verify the archive's SHA-256 against that exact filename before extracting into a temporary directory. Preserve the complete Skill folder, including `scripts/agentflow-runtime.mjs`, references, examples and licenses. This supports graph creation, validation, host execution, recovery and offline HTML panels.
2. Resolve an available Node.js **22.13+** executable: inspect `node` on PATH and runtimes explicitly exposed by the host, then confirm the selected executable's version. For Codex desktop, use its workspace-dependency tool when available to discover the bundled Node path. Do not hardcode a Codex cache version or assume a native coding-agent executable includes Node.
3. If no compatible runtime is available, explain that this dependency is needed for the requested Skill and provision a current maintained Node LTS binary from `https://nodejs.org/` in a dedicated user directory, such as `~/.local/share/agentflow/node/<version>-<platform>-<arch>` or `%LOCALAPPDATA%/AgentFlow/runtimes/node/<version>-<arch>`. Select the actual operating system and CPU architecture, verify the official checksum, and retain the runtime's license files. Use its absolute executable path; keep system PATH and existing Node installations intact. Follow the host's permission requirements for downloads and local writes.
4. With the selected Node executable, run `<node> "<extracted skill>/scripts/agentflow.mjs" skill install --host codex --user` (or the requested host/project). This records the executable in the Skill's launcher. For an older published bundle without `skill install`, copy its complete folder to the approved Skill destination and record the selected absolute Node invocation in its setup instructions.

For an explicitly requested source version, build that checkout with `npm ci` and `npm run skill:build`, then install `dist/skills/agentflow`. Copying `skills/agentflow` from GitHub alone provides the authoring source; it does not include the compiled CLI. Keep source instructions and compiled code from the same release or build.

## Verify and report

Use the installed command to run `host validate "<installed skill>/assets/review-flow.json"` and confirm `valid: true`. Report the Skill location, selected runtime and invocation (`$agentflow` in Codex, `/agentflow` in Claude Code). If the host has not discovered it, refresh or reopen the session. Offer the [desktop download](https://github.com/v1xerunt/AgentFlow/releases) for the full interactive editor. Installing the desktop GUI is a separate user choice.
