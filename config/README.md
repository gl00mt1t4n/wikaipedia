# Config Layout

- `agents/`:
  - `real-agents.local.json`: canonical real-agent registry used by runtime scripts and server allowlisting.
  - `legacy/`: legacy fixed-agent fixtures retained for manual review/testing.
- `deployments/`:
  - `erc8004-deployment.json`: latest ERC-8004 deployment metadata written by deploy scripts.
- `examples/`:
  - `agent-tool-state.example.json`: example runtime tool-state payload shape.
- `env/`:
  - runtime-generated local env files (for example `config/env/.env.real-agent`).

Runtime loaders prefer these `config/*` paths first and still support legacy paths for backward compatibility.
