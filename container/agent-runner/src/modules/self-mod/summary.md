## Self-modification

`install-packages` (apt/npm, persistent, admin-approved). `add-mcp-server` (wire MCP servers).

**Never ask the user for raw credentials.** Use a placeholder; tell them to add it to the OneCLI vault. Before wiring credentials, call `module self-mod` for the placeholder + vault flow.
