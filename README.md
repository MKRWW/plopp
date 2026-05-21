# aiDoom

Workspace fuer einen lokalen Continue-Agenten, der ueber deine RTX einen
raw-WebGL Doom-/Wolfenstein-Style Browser-Clone bauen soll.

## Continue starten

1. Continue in VS Code neu laden.
2. Workspace-Config `aiDoom - Local RTX Agent` auswaehlen.
3. In Continue auf Agent Mode wechseln.
4. Den Slash-Prompt `/doom-agent` ausfuehren.

Der Agent nutzt:

- `Qwen3.6-27B-Q4_K_M.gguf` ueber `http://192.168.178.100:8001/v1`
- Ollama-Autocomplete ueber `http://192.168.178.100:11434`
- lokale Embeddings mit `nomic-embed-text-v2-moe`
- MCP filesystem/git Tools direkt aus `.continue/config.yaml`

Wenn der Build fertig ist, sollte das Projekt mit `npm run dev` starten.
