# AgentFlow CLI

**English** · [简体中文](cli.zh-CN.md) · [Back to README](../README.md)

The CLI validates AgentFlow graphs and coordinates their execution from the command line. Its JSON task interface supports the [AI-native skill](../skills/agentflow/SKILL.md): a coding agent turns the user's intent into a Flow, receives its next task from the CLI, and submits the results. The host session supplies the model, tools, and permissions.

| Command family | Purpose |
| --- | --- |
| `host …` | Coordinate real work performed by the current coding-agent session; JSON responses. |
| `validate` | Validate a YAML or JSON graph against the shared graph schema. |
| `run` | Execute a graph using the built-in Fake provider for demonstration. |

## Build and install

For a Skill installation request, follow [installation and runtime setup](../skills/agentflow/references/installation.md). It checks for an existing desktop CLI before selecting the lightweight package and a host-provided or private Node runtime.

The desktop package contains a command at `<install>/resources/agentflow/agentflow.cmd` on Windows or `AgentFlow.app/Contents/Resources/agentflow/agentflow` on macOS. Invoke it with `skill install --host codex --user` (or `--host claude`, or `--project "<directory>"`). This command installs the Skill only when invoked. Its launcher uses the application's built-in runtime with the GUI closed. No global PATH changes are needed.

The complete lightweight Skill archive can install itself with `<node> "<extracted skill>/scripts/agentflow.mjs" skill install --host codex --user`. It records the selected Node executable in the installed launcher. Older releases can be copied as a complete Skill folder; see the installation procedure above.

For source development, use Node.js **22.13+**. From the repository root:

```sh
npm ci
npm run build --workspace @agentflow/cli
node apps/cli/dist/index.js --help
node apps/cli/dist/index.js host --help
```

To give a coding agent the skill and its bundled CLI:

```sh
npm run skill:build
node scripts/install-skill.mjs --host both --project "/path/to/your/project"
```

On Windows, use a quoted path such as `"D:/Projects/My Project"`. Running the installer directly with Node preserves its arguments across shells.

| Installer option | Meaning |
| --- | --- |
| `--host codex` | Install to `.agents/skills/agentflow` under the target directory. |
| `--host claude` | Install to `.claude/skills/agentflow` under the target directory. |
| `--host both` | Install for both hosts; the source convenience script defaults to this. |
| `--project <directory>` | Install for one project. |
| `--user` | Install under the user's home directory; use this in place of `--project`. |

The installer stops if a target skill already exists. Preserve any local edits and move the existing installation before installing a replacement. These locations follow the hosts' skill discovery conventions: [Codex](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills), [Claude Code](https://code.claude.com/docs/en/skills).

`dist/skills/agentflow` is the complete distributable folder, including the runtime and license notices. Once copied to a skill directory, it needs Node.js but no repository checkout or dependency installation. From a project with the Codex installation:

```sh
node .agents/skills/agentflow/scripts/agentflow.mjs host --help
```

For Claude Code, use `.claude/skills/agentflow/scripts/agentflow.mjs`. Agents should resolve the helper's absolute path from the skill location and execute commands in the user's workspace.

## Run a Flow with the host agent

The following commands run from the repository root. The supplied [example graph](../skills/agentflow/assets/review-flow.json) contains source material, a writer, a reviewer, and a reviser. In everyday use, the coding agent creates the graph from the user's request.

### 1. Validate and start

```sh
node apps/cli/dist/index.js host validate skills/agentflow/assets/review-flow.json
node apps/cli/dist/index.js host start skills/agentflow/assets/review-flow.json --workspace . --run-dir .agentflow/runs/weekly-brief
```

`start` saves the accepted graph and Input artifacts. It returns `runDirectory`, the current `ready` node IDs, and artifact paths. The workspace must exist; the run directory must be new. Omit `--run-dir` to allocate a unique directory under `<workspace>/.agentflow/runs/`.

### 2. Claim a task

```sh
node apps/cli/dist/index.js host next .agentflow/runs/weekly-brief
```

The response includes:

| Field | How the host uses it |
| --- | --- |
| `task.id` | The exact task ID to use when submitting or failing this attempt. |
| `task.nodeId`, `task.attempt` | The role being executed and its attempt number. |
| `node.name` | The user-facing role name. |
| `workspace` | The working directory for the task's tools and files. |
| `messages` | The composed System/User instructions and connected material. |
| `relations` | The incoming relation labels, such as `review` or `merge`. |
| `upstream` | Direct source node IDs, artifact IDs, and readable artifact paths. |
| `resultPath` | The suggested UTF-8 Markdown file for the host to write. |

Claiming a task marks it `running`. **The host agent now performs the task** using the returned messages and its available tools. It writes the complete result to `resultPath`. For file deliverables, the result should include the verified workspace-relative paths and enough content for downstream roles to use.

### 3. Submit the result and continue

Replace `<task-id>` and `<result-path>` with the values returned above:

```sh
node apps/cli/dist/index.js host submit .agentflow/runs/weekly-brief "<task-id>" --file "<result-path>"
node apps/cli/dist/index.js host next .agentflow/runs/weekly-brief
```

Repeat the claim → execute → submit cycle until `status` is `completed`. Each accepted result becomes an immutable artifact; downstream nodes become ready after all their direct dependencies finish. A Merge receives each of its named sources.

When no task is ready, `next` returns `task: null` together with the run status. Inspect that status: running workers or failed dependencies may still require attention. Only `status: completed` means the Flow is finished.

## Command reference

Prefix each command with `node apps/cli/dist/index.js`, or the installed skill helper's absolute path. Each subcommand supports `--help`.

| Command | Behavior |
| --- | --- |
| `host validate <graph>` | Validate JSON/YAML against the graph schema and host execution profile. |
| `host start <graph> [--workspace <directory>] [--run-dir <directory>]` | Start a new run from a graph snapshot. Workspace defaults to `.`. |
| `host status <run>` | Read run/node states, ready IDs, outstanding task IDs, errors, and artifact paths. |
| `host next <run> [--node <id>]` | Claim one ready Agent, optionally selecting its node ID. |
| `host request <run> <task>` | Read the compiled request for an existing running task. |
| `host submit <run> <task> --file <path>` | Accept the complete Markdown result for that task. |
| `host fail <run> <task> --reason <text>` | Record why a running task could not complete. |
| `host retry <run> <node>` | Claim a new attempt for a failed node and return its request. |
| `host panel <graph-or-run> --out <html>` | Write an offline graph editor or read-only run snapshot to a new file. |

`<run>` is the run directory, `<task>` is an attempt's task ID, and `<node>` is a graph node ID. `retry` immediately creates a running attempt; execute its returned request and submit the new task ID.

## JSON and status handling

Host commands return JSON on stdout. Operational errors return `{"error":"…"}` on stderr and exit with code 1. Successful calls exit with code 0. Argument errors also exit nonzero; usage/help output is plain text. Host commands always use JSON, so they do not need `--json`.

| Node status | Meaning |
| --- | --- |
| `ready` | Dependencies are complete and the task can be claimed. |
| `waiting` | One or more direct dependencies remain; see `waitingFor`. |
| `running` | A task has been claimed and is awaiting a result. |
| `completed` | An accepted artifact exists. |
| `failed` | The latest attempt stopped with an error; inspect `error`. |

Run status is `completed` when every node is complete, `running` while any task is in flight, `blocked` when a failure remains with no running task, and otherwise `ready`. A blocked run can still have independent ready branches. Use the per-node states and `ready` list to decide the next action.

Submitting the same task with identical content is idempotent. Different content cannot replace its completed artifact. Empty results and submissions from failed task IDs are rejected. To change accepted work, edit the source Flow and start a new run.

## Resume, retry, and parallel work

After an interruption:

```sh
node apps/cli/dist/index.js host status "<run>"
node apps/cli/dist/index.js host request "<run>" "<task>"
```

Use `request` to recover an in-flight task. If its verified result is already on disk, submit that file. Check existing file changes and external effects before repeating work.

When a worker has stopped and its cause has been resolved:

```sh
node apps/cli/dist/index.js host fail "<run>" "<task>" --reason "Worker interrupted before producing a result"
node apps/cli/dist/index.js host retry "<run>" "<node>"
```

Previous attempts remain recorded, and completed upstream artifacts are reused within the run. The skill uses a bounded retry: repeat once after fixing the cause, then report a persistent blocker. The CLI leaves retry policy to its caller.

For parallel execution, claim separate IDs from `status.ready` and assign each request to a native host subagent when available. Serialize the short CLI mutations, allow the model work to overlap, and keep workspace writes from conflicting. A single host session can also execute the roles sequentially; those roles share its conversation context.

The run lock rejects overlapping writes. Retry a lock conflict after the other command exits. If a command crashed, inspect the process ID in `.lock` and verify that process has exited before removing the stale lock. The host manages stopping its workers; `host fail` records their interruption.

## View and edit a Flow

```sh
node apps/cli/dist/index.js host panel skills/agentflow/assets/review-flow.json --out flow-panel.html
node apps/cli/dist/index.js host panel .agentflow/runs/weekly-brief --out run-panel.html
```

Open the HTML file in a browser or a host preview that supports local HTML. Graph panels edit the Flow name/goal, node names, text inputs, unlocked prompts, and single-source Agent relation labels. Export downloads `flow.json`; give the file back to the agent, validate it, and start a new run. Structural changes can be made through conversation or by editing the graph file.

Run panels show the saved progress and results at generation time. Generate a fresh panel for updated progress. Each `--out` path must be new. The panel operates offline and hands execution back to the host through the exported graph.

## Files and supported graphs

```text
<workspace>/
  .agentflow/runs/<run-id>/
    graph.json               Accepted graph snapshot
    state.json               Checksummed run, tasks, and artifacts
    artifacts/<hash>.md      Immutable results, located via host status
    results/<task-id>.md      Suggested submission files written by the host
    .lock                    Present while a CLI mutation is active
```

Runtime state uses atomic replacement. Treat the run files as records and make edits in the source Flow. Changing the Flow starts a fresh run; moving a workflow to another workspace also requires a new run because the saved workspace path is absolute. Desktop projects use their own `.flow/project.json` container.

Command paths resolve against the invocation directory (`INIT_CWD` when supplied, otherwise the current working directory). `--workspace` sets the execution context without changing how other command arguments resolve. Use quoted absolute paths when the helper runs from a different directory.

Host graphs use the shared version 1 schema with `provider: host` and `model: inherit`. Provide nonempty System and Output prompts, visible text inputs, and an acyclic graph. Read PDFs, images, and other files with host tools, then supply extracted text or workspace-relative references as text. Host outputs are Markdown artifacts; file deliverables are created by the host. Desktop Output nodes, tutorial mode, per-node model parameters, and implicit `for-each` inputs require conversion to the host profile. See the [Flow specification](../skills/agentflow/references/flow-spec.md) for the complete authoring contract.

## Graph validation and the demo runner

```sh
node apps/cli/dist/index.js validate examples/review-flow.yaml --json
node apps/cli/dist/index.js run examples/review-flow.yaml --no-delay --json
```

`validate` checks the shared graph format; `--json` returns the path, name, node count, and link count. `host validate` additionally checks host execution requirements.

`run` demonstrates the built-in Fake provider. `--no-delay` removes simulated latency; `--json` prints the run, events, and artifacts. Use the `host` task protocol for real work with a coding-agent session, and the desktop app for configured provider execution.
