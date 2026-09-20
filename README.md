# Akutkompassen – webbapp (v10, version ak-v10s2b)

Nytt i v10: appen är uppdelad i en liten startsida och separata datafiler per område (`ak_*.json`). Den öppnar direkt, hämtar PM-texten i bakgrunden och fungerar offline efter första besöket. Internationella riktlinjer visas som länkar till utgivaren – ingen upphovsrättsskyddad text lagras i appen.

| Fil | Vad |
|---|---|
| `index.html` | Appen (gränssnitt, sök, läsare) – liten fil |
| `ak_index.json` | Register över alla dokument (titel, år, område, länk) |
| `ak_<OMRÅDE>.json` | PM-text per område, hämtas när den behövs |
| `manifest.webmanifest` | Installerbar som app med ikon |
| `sw.js` | Offline-stöd (service worker). `VERSION` ändras vid varje släpp |
| `icon-*.png`, `apple-touch-icon.png`, `favicon.png` | Ikoner |

## Publicera / uppdatera (GitHub Desktop)

Den här mappen (`Documents/GitHub/Akutkompassen`) är en klon av repot. Claude skriver nya byggen direkt hit.

1. Öppna GitHub Desktop – ändrade filer listas under **Changes**.
2. Skriv en kort rad i **Summary** (t.ex. `v10 steg 3`) → **Commit to main**.
3. Klicka **Push origin**. Efter 1–2 minuter är https://hrafnkellstefans.github.io/Akutkompassen/ uppdaterad; telefoner hämtar nya versionen nästa gång appen öppnas med nät.

Ångra ett släpp: fliken **History** → högerklicka på committen → **Revert changes in commit** → Push origin.

## Obs

Repot är publikt. Innehållet är text ur offentliga DocPlus-PDF:er (Region Uppsala) samt titlar/länkar – inga patientdata, inga interna dokument, ingen text ur läroböcker eller internationella riktlinjer.
