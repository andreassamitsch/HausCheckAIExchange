# HausCheck AI Exchange

Privates Austausch-Repository für HausCheck-Pro-Analysepakete und ChatGPT-Ergebnisse.

## Ablauf

```text
HausCheck
→ exportiert Analyse-ZIP nach ai_exchange/exports/pending/<house_id>.zip

ChatGPT Task
→ prüft stündlich ai_exchange/exports/pending
→ analysiert ZIPs anhand README_PROMPT.md im Paket
→ schreibt Ergebnis nach ai_exchange/results/pending/<house_id>/hauscheck_analysis.json

HausCheck
→ importiert GitHub-Ergebnisse
→ archiviert erfolgreiche JSONs nach ai_exchange/results/done/<house_id>/...
→ löscht pending-ZIP und pending-JSON, wenn Cleanup aktiv ist
```

## Ordner

```text
ai_exchange/
├── exports/
│   └── pending/
├── results/
│   ├── pending/
│   └── done/
└── errors/
```

## HausCheck Add-on Optionen

```yaml
github_exchange_enabled: true
github_repo: "andreassamitsch/HausCheckAIExchange"
github_branch: "main"
github_token: "DEIN_GITHUB_TOKEN"
github_export_path: "ai_exchange/exports/pending"
github_result_path: "ai_exchange/results/pending"
github_done_path: "ai_exchange/results/done"
github_cleanup_after_import: true
```

## Hinweise

- Dieses Repository ist bewusst privat.
- Analyse-ZIPs können Bilder und Inseratsdaten enthalten.
- Nach erfolgreichem Import räumt HausCheck pending-Dateien auf.
- JSON-Ergebnisse werden unter `results/done` archiviert.
