# Flow format and execution semantics

The portable format is `GraphDefinition` version 1, shared with AgentFlow's desktop app and CLI. In the source repository, `packages/schema/src/index.ts` is authoritative. Validate with `host validate` for the host execution profile.

## Shape

```json
{
  "version": 1,
  "name": "Research brief",
  "goal": "A specific user outcome",
  "nodes": {
    "brief": {"type":"input","name":"Requirements","items":[
      {"id":"requirements","name":"Requirements","kind":"text","mode":"text","content":"Actual supplied requirements"}
    ]},
    "writer": {"type":"agent","name":"Writer","provider":"host","model":"inherit","prompts":{
      "system":{"content":"Role, objective, decision criteria, and scope.","customized":true,"locked":false},
      "input":{"content":"How to use the supplied requirements.","customized":true,"locked":false},
      "output":{"content":"A complete deliverable with a verifiable format.","customized":true,"locked":false}
    }}
  },
  "links":[{"id":"brief-writer","sourceId":"brief","targetId":"writer","type":"input"}]
}
```

Node IDs and Link IDs must be unique in their respective collections. Positions are optional `{ "x": number, "y": number }` hints for the desktop. The host panel arranges dependency levels automatically.

## Relations

| Type | Source | Meaning for the downstream Agent |
| --- | --- | --- |
| `input` | Input | Use original task material. |
| `pass` | Agent | Continue from the supplied work. |
| `review` | Agent | Evaluate it against stated criteria. |
| `revise` | Agent | Produce a complete revised deliverable from the supplied material. |
| `merge` | Two or more Agents | Combine the named direct sources under explicit criteria. |

Single-source links use `sourceId`; Merge uses `sourceIds` with at least two distinct IDs. Every link targets an Agent. Several Inputs can connect to one Agent. Multiple Agent sources should form one Merge link. Avoid duplicate source-target pairs, self-links, and cycles.

For draft → review → revision, the final Agent often needs a Merge of draft and review. If reviewers need the original evidence, connect that Input to each reviewer. Direct dependencies determine context: ancestor material is not automatically included in a grandchild's prompt. Parent/source-input IDs are provenance, not additional context.

Relations are labels and dependencies. `review` does not automatically add critique instructions; `revise` does not recover an unseen draft. Author the downstream Input and Output prompts accordingly. Multiple rounds use distinct nodes in a finite DAG.

## Prompt composition

Host requests use the core's `composeInvocation`:

1. System prompt as a System message.
2. Input prompt, current task goal, connected artifact contents, and Output prompt as a User message.
3. Multiple upstream artifacts are labeled `Source 1`, `Source 2`, etc., in Link/source order.

Each completed node creates one immutable Markdown artifact with direct parent artifact IDs and transitive source-input IDs. A graph/run snapshot captures the accepted Flow. State is stored under `.agentflow/runs/`; the desktop's `.flow/project.json` is a separate project container.

## Host profile

- Agent nodes use exactly `provider: host` and `model: inherit`; per-node model parameters belong to the host session. All Agents need System and Output instructions.
- Input items use `mode: text`. Hidden items are excluded. Each Input must contain visible text.
- For PDF, DOCX, images, CSV, or repository files, use the host's reading tools. Embed extracted material where practical. For tool-based analysis, put a workspace-relative filename and its purpose in text, and instruct the node to inspect that file. Snapshot important source text when repeatability matters; a referenced working file can change between executions.
- File-producing Agents write within the user-authorized workspace and return a useful Markdown result with deliverable paths. Downstream nodes read those files only when their instructions call for it. Shared workspace access is not a security boundary between roles.
- Host outputs are Markdown artifacts. Desktop Output nodes, tutorial graphs, and implicit `for-each` execution require an explicit conversion to this profile. Unsupported configurations fail validation.
- A new graph starts a new run. This version resumes existing tasks and retries failed nodes; it recomputes the graph after edits rather than reusing potentially stale results.
