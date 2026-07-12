# HausCheck Base64 Bildtest

Dieses Verzeichnis testet einen binärfreien GitHub-Bildtransport.

## Aufgabe

1. Lies `manifest.json`.
2. Lies pro Bild alle in `chunks` gelisteten `part_*.txt` Dateien.
3. Setze die Textteile exakt in Reihenfolge zusammen.
4. Entferne alle Whitespaces/Zeilenumbrüche aus dem Base64-Text.
5. Base64-decode den zusammengesetzten Text zu einer JPG-Datei.
6. Öffne das rekonstruierte Bild und prüfe, ob echte visuelle Analyse möglich ist.
7. Antworte zunächst nur mit einem kurzen Testergebnis: Bild decodierbar ja/nein, Bild sichtbar ja/nein, grobe Bildbeschreibung.

## Python-Beispiel

```python
import base64, json, re
from pathlib import Path

manifest = json.loads(Path('manifest.json').read_text())
for image in manifest['images']:
    raw = ''.join(Path(part).read_text() for part in image['chunks'])
    b64 = ''.join(raw.split())
    Path(image['output_file']).write_bytes(base64.b64decode(b64))
```

house_id: 56df78a2
