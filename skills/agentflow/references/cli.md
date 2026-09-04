# Host CLI

Run `node "<absolute skill directory>/scripts/agentflow.mjs" <command>`. Commands return JSON on stdout. Errors return JSON on stderr with exit code 1; command-line usage errors also exit nonzero. Quote paths, especially on Windows. Use real argument arrays when invoking through code.

| Command | Effect |
| --- | --- |
| `host validate <graph>` | Check portable JSON/YAML and host execution constraints. |
| `host start <graph> --workspace <dir> [--run-dir <new-dir>]` | Snapshot the graph, save Input artifacts, and allocate a new run. |
| `host status <run>` | Read states, ready nodes, waiting dependencies, task IDs, errors, and artifact paths. |
| `host next <run> [--node <id>]` | Claim one ready Agent and return compiled messages plus `resultPath`. |
| `host request <run> <task>` | Recover the same request for an in-flight task without another claim. |
| `host submit <run> <task> --file <markdown>` | Store the completed result and its lineage. |
| `host fail <run> <task> --reason <text>` | Record a real interruption/error; dependent nodes stay waiting. |
| `host retry <run> <node>` | Claim a fresh attempt for one failed node. |
| `host panel <graph-or-run> --out <new-html>` | Export an offline graph editor or read-only run snapshot. |

Relative command paths resolve against the invocation directory, not the skill installation. The run remembers an absolute workspace. To move a workflow, move its graph and source files and start a run in the destination workspace.

## Execution contract

`start` and `next` prepare work. They never call an API, log into an account, spawn another coding-agent CLI, or fabricate node text. The calling agent must perform each node and submit its result.

`next` returns one task at a time. Inspect `status.ready` and claim more independent nodes to use the host's native concurrency. Serialize the brief CLI mutations and let the model work run in parallel. The run lock rejects concurrent writes; retry a lock conflict after the other command exits. Do not run two writers against one deliverable file.

Do not infer completion from an empty ready list. `status: completed` is the success condition. `running` means a claimed task is outstanding. `blocked` means a failure remains; inspect node errors and waiting dependencies. Independent branches may still finish.

`submit` is idempotent for the same task and identical result. A different result cannot overwrite an accepted artifact. Failed task IDs cannot submit into a newer attempt. An empty result is rejected.

## Resume and retry

After a conversation interruption, inspect `host status`. For a running task, use `host request`; if its verified result file already exists, submit it. Check whether external actions or file writes already happened before repeating them.

If the worker stopped irrecoverably, mark its task failed. Retry once when the cause is fixed, the action remains authorized, and repetition will not duplicate an external effect. A repeated failure or missing access/material requires a concise user-facing explanation; retain the run and completed results.

Tasks that merely wait on a child are still running. Do not fail or retry them because they take time. Stop claiming further tasks when the user asks to stop; preserve completed artifacts and mark interrupted tasks failed after stopping their workers.

The `.lock` file records the short-lived CLI process ID. Never remove an active writer's lock. After a crash, verify that process has exited before removing the stale `.lock` and retrying the command. `state.json` is checksummed and written through an atomic rename; edit the source graph for a new run instead of editing runtime state. `artifacts/` contains immutable readable copies. `results/` is the host's submission staging directory.
