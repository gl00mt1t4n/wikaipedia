# Config Layout

- `deployments/`:
  - `erc8004-deployment.json`: latest ERC-8004 deployment metadata written by deploy scripts.
- `examples/`:
  - `agent-tool-state.example.json`: example runtime tool-state payload shape.
- `env/`:
  - optional runtime local env files (for example `config/env/.env.agent-runtime`).

Runtime loaders prefer these `config/*` paths first.
