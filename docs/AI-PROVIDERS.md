<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="CONFIGURATION.md">⚙️ Configuration</a> · <a href="TROUBLESHOOTING.md">🔧 Troubleshooting</a>
</p>

---

# AI Providers Setup — OIA – Overthinker Image AI

OIA supports a modular Hybrid AI Engine (`LOCAL_ONLY`, `CLOUD_ONLY`, `HYBRID`) without hardcoding a single model.

## 1. Heuristic (Built-in Offline Fallback)
- `AI_PROVIDER=heuristic`
- Works with zero external services or GPU.

## 2. Local AI Providers
- **Ollama**: Set `OLLAMA_BASE_URL=http://localhost:11434` and `OLLAMA_MODEL=llama3.1:8b` (or your installed model).
- **LM Studio / Local OpenAI-Compatible**: Set `LOCAL_OPENAI_BASE_URL=http://localhost:1234/v1` and `LOCAL_OPENAI_MODEL=<model>`.
- **ComfyUI (Image & Video)**: Set `COMFYUI_BASE_URL=http://localhost:8188` and `COMFYUI_DEFAULT_MODEL=<checkpoint>`.

## 3. Cloud AI Providers (Optional)
- **OpenAI**: Configure `OPENAI_API_KEY` in `.env` (never commit to Git).
- **Google Gemini**: Configure `GEMINI_API_KEY` in `.env` (never commit to Git).
- Cloud uploads respect explicit workspace privacy consent gates.
