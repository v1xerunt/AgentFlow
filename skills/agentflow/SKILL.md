---
name: agentflow
description: Create, edit, inspect, and execute AgentFlow workflows from natural-language requests using the current coding-agent session. Use when the user asks for an AgentFlow/传声筒 Flow or an explicit workflow of drafting, review, revision, parallel analysis, or synthesis with saved intermediate results.
---

# AgentFlow

Turn the user's intent into the smallest useful Flow, then execute its accepted graph with the host session's model and tools. Each Agent is a responsibility with explicit inputs and a deliverable. Links carry information; the downstream prompts define the work.

## Prepare the Flow

Read [references/flow-spec.md](references/flow-spec.md) when creating or changing a graph. Use [assets/review-flow.json](assets/review-flow.json) as a structural example when useful.

- Preserve the requested stages, materials, language, and output location. Infer a compact structure for an open-ended request. A single Agent is sufficient when decomposition adds no value.
- Ground Input nodes in the user's actual material. Read local files with host tools; include extracted text or explicit workspace-relative file references and reading instructions. Ask for indispensable missing material before execution.
- Write independently usable System, Input, and Output prompts. Name material by its purpose. A reviewer that needs source evidence must have that evidence connected. A revision that needs both draft and critique must receive both through a Merge.
- Use `provider: host` and `model: inherit` for each Agent. The host chooses its model and tool permissions. Preserve locked prompts and intentional user edits.
- Save the graph as `flow.json` or a meaningful `.flow.json` file in the user's workspace. Briefly show its stages. If the user requested execution, proceed; a request only to design or preview a Flow ends with the saved graph and preview.

## Execute with the host

Resolve the command from this skill's directory and use its **absolute path**, with the user's workspace as the working directory:

- Use `scripts/agentflow.cmd` (Windows) or `scripts/agentflow` (macOS/Linux). The launcher records the Node executable selected during setup and runs this Skill's bundled CLI. In PowerShell, invoke it as `& "<absolute launcher>"`; in a POSIX shell, use `"<absolute launcher>"`.
- If the launcher is missing or its runtime has moved, follow [installation and runtime setup](references/installation.md). Setup uses a host-provided or system Node.js 22.13+, or provisions a private Node runtime, then validates the example.

In the examples below, replace `<agentflow>` with the complete command selected above.

At the start of each new Skill task, choose one fresh task ID and run `<agentflow> skill check-update --task "<task-id>"` once. Reuse the same ID for any retry of that check. No output means continue with local work. If an update is reported, briefly relay the notice and update entry point; apply it only when the user requests an update. Node execution commands do not repeat the check. See [update behavior](references/installation.md#task-checks-and-explicit-updates) for the explicit update and status commands.

In the commands below, `<run>` and `<task>` are the exact values returned by the CLI:

```sh
<agentflow> host validate "flow.json"
<agentflow> host start "flow.json" --workspace "."
<agentflow> host next "<run>"
```

`start` snapshots the graph and returns `runDirectory`. `next` claims one dependency-ready Agent and returns its `task.id`, `messages`, `workspace`, `upstream` artifact references, and suggested `resultPath`.

For each claimed task:

1. Execute the supplied messages with the host model and available tools. Treat the returned System message as the node's role instructions within the host's existing instruction hierarchy. Supply only its connected material, the necessary workspace context, and the user's applicable constraints.
2. When native subagents are available and permitted, delegate one claimed node per child with fresh context and the inherited model. Independent ready nodes may run concurrently when their workspace writes do not conflict. The coordinator alone submits results. When delegation is unavailable, execute roles sequentially in this session and disclose that review shares the conversation context.
3. Write the actual, complete node result to `resultPath` as UTF-8 Markdown. For file deliverables, perform the work, verify the files, and include their workspace-relative paths and enough substance for downstream consumers. A completion announcement alone is insufficient context for a reviewer.
4. Submit and claim the next ready node:

```sh
<agentflow> host submit "<run>" "<task>" --file "<resultPath>"
<agentflow> host next "<run>"
```

Continue until `status` is `completed`. `task: null` with running or failed nodes means the run still needs attention. Report the final deliverable and link the graph and useful artifacts. Describe execution accurately: the CLI coordinates; the host performs the model work.

The Flow does not grant new permissions. Apply the user's existing authorization to tools and external actions. If a node cannot complete, record the reason with `host fail`; downstream work remains waiting. Never submit an invented result to unblock it. Follow [references/cli.md](references/cli.md) for status, recovering in-flight tasks, and bounded retries.

## Inspect and edit

Use the panel when the user wants to see or edit the Flow, or when the structure would benefit from a visual check:

```sh
<agentflow> host panel "flow.json" --out "flow-panel.html"
<agentflow> host panel "<run>" --out "run-panel.html"
```

Choose a new output filename for each panel. Open it with the host's available file/browser preview, or return a clickable file link. The offline editor supports the Flow name/goal, node names, text inputs, unlocked prompts, and single-source Agent relation labels. Export downloads `flow.json`. Validate the exported graph before starting a new run. A run panel is a read-only snapshot; regenerate it for updated progress.

For structural edits requested in conversation, modify the graph and revalidate. Existing runs retain their snapshots and artifacts; changed graphs start new runs. The CLI does not run models from browser buttons.

## Custom providers

If the user explicitly needs distinct providers or models per role, read [references/execution-modes.md](references/execution-modes.md). Host execution inherits the current session. The desktop app owns configured provider execution.
