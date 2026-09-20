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

## Publicera / uppdatera på GitHub Pages

1. Öppna repot `Akutkompassen` på github.com → **Add file → Upload files**.
2. Klicka **choose your files**, markera **alla filer** i den här mappen (⌘A i filväljaren – zip-filen kan vara med, den skadar inte) → **Öppna**. **Commit changes.**
3. Vänta 1–2 minuter. Adressen är oförändrad: https://hrafnkellstefans.github.io/Akutkompassen/

Alla telefoner hämtar nya versionen automatiskt nästa gång appen öppnas med nät (versionen styrs av `VERSION` i `sw.js` och `ak_index.json`).

Tips: enklast att ta bort gamla filer först är att i repot klicka på `index.html` → papperskorgen → commit, och sedan ladda upp allt nytt. Gamla `index.html` från v9 (5 MB) behövs inte längre.

## Obs

Repot är publikt. Innehållet är text ur offentliga DocPlus-PDF:er (Region Uppsala) samt titlar/länkar – inga patientdata, inga interna dokument, ingen text ur läroböcker eller internationella riktlinjer.
