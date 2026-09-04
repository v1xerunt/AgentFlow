# Choosing an execution mode

| Need | Mode |
| --- | --- |
| Create a Flow and run it using this conversation's model/tools | Host CLI and this skill |
| Inspect and edit prompts before running | Offline HTML panel; export and validate the edited graph |
| Change roles, branches, evidence routes, or review rounds | Edit the portable graph with the agent; validate and start a new run |
| Different providers, credentials, model parameters, persistent per-Agent chats, or native file Result nodes | AgentFlow desktop app |

Host execution inherits the current coding-agent framework's model selection, permissions, billing, and available tools. A role name does not select a model. Use native host model selection only when the host exposes it and the user explicitly requests it; this CLI profile itself keeps `model: inherit`.

For provider execution, create the corresponding Flow in the desktop canvas using the saved goal, roles, connections, and authored prompts as the specification. Configure model connections in Settings and select a supported provider/model for each Agent before running. Desktop projects use the `.flow/project.json` project container; the skill produces standalone graph files. Use the app's project save/open operations for desktop persistence.

The host skill contains no credential store or per-node provider client. Do not read a host's private login tokens or configure providers merely to execute a host Flow. If the user chooses provider execution, perform configuration through the app's supported connection flow with credentials kept outside graph files.

The HTML panel is a local file with editing/export controls and snapshot results. Its contents stay in the file. A host with browser preview can show it in the app; terminal-only environments can open it in a browser. It has no live link to the conversation or provider settings. Exporting a graph hands changes back to the agent for the next run.
