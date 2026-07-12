# HausCheck Base64 Bildtest

Dieses Verzeichnis testet einen binärfreien GitHub-Bildtransport.

## Aufgabe

1. Lies `manifest.json`.
2. Lies pro Bild alle in `chunks` gelisteten `part_*.txt` Dateien.
3. Setze die Textteile exakt in Reihenfolge zusammen.
4. Base64-decode den zusammengesetzten Text zu einer JPG-Datei.
5. Öffne das rekonstruierte Bild und prüfe, ob echte visuelle Analyse möglich ist.
6. Antworte zunächst nur mit einem kurzen Testergebnis: Bild decodierbar ja/nein, Bild sichtbar ja/nein, grobe Bildbeschreibung.

## Python-Beispiel

```python
import base64, json
from pathlib import Path

manifest = json.loads(Path('manifest.json').read_text())
for image in manifest['images']:
    b64 = ''.join(Path(part).read_text().strip() for part in image['chunks'])
    Path(image['output_file']).write_bytes(base64.b64decode(b64))
```

house_id: 69e948cf
