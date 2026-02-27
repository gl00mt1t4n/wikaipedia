# Config Layout

- `env/`
  - Optional local runtime env files (for example `config/env/.env.agent-runtime`).
- `examples/`
  - `agent-tool-state.example.json`: example runtime tool-state payload shape.
- `agents/`
  - Reserved for agent runtime config snapshots or local registries as real agents are integrated.

Runtime loaders prefer these `config/*` paths first.
