# Akutkompassen – webbapp (v10, version ak-v10s2d)

Nytt i v10: appen är uppdelad i en liten startsida och separata datafiler per område (`ak_*.json`). Den öppnar direkt, hämtar PM-texten i bakgrunden och fungerar offline när hela versionen har sparats av webbläsaren. Internationella riktlinjer visas som länkar till utgivaren – ingen upphovsrättsskyddad text lagras i appen.

| Fil | Vad |
|---|---|
| `index.html` | Appen (gränssnitt, sök, läsare) – liten fil |
| `ak_index.json` | Register över alla dokument (titel, år, område, länk) |
| `ak_<OMRÅDE>.json` | PM-text per område, hämtas när den behövs |
| `manifest.webmanifest` | Installerbar som app med ikon |
| `sw.js` | Offline-stöd (service worker). `VERSION` ändras vid varje släpp, samtidigt som versionsnumret i `index.html` och `ak_index.json` |
| `icon-*.png`, `apple-touch-icon.png`, `favicon.png` | Ikoner |

## Publicera / uppdatera (GitHub Desktop)

Den här mappen (`Documents/GitHub/Akutkompassen`) är en klon av repot. Claude skriver nya byggen direkt hit.

1. Öppna GitHub Desktop – ändrade filer listas under **Changes**.
2. Skriv en kort rad i **Summary** (t.ex. `v10 steg 3`) → **Commit to main**.
3. Klicka **Push origin**. Efter 1–2 minuter är https://hrafnkellstefans.github.io/Akutkompassen/ uppdaterad; webbläsaren hämtar en ny version i bakgrunden när appen öppnas med nät. Stäng alla öppna flikar/fönster med appen och öppna den igen för att aktivera den färdighämtade versionen.

Ångra ett släpp: fliken **History** → högerklicka på committen → **Revert changes in commit** → Push origin.

## Obs

Repot är publikt. Innehållet är text ur offentliga DocPlus-PDF:er (Region Uppsala) samt titlar/länkar – inga patientdata, inga interna dokument, ingen text ur läroböcker eller internationella riktlinjer.


## Offline och uppdateringar

Service workern sparar appen, registret och samtliga 21 områdesfiler (cirka 4 MB totalt) innan en ny version kan installeras. En uppdatering väntar tills alla flikar med den gamla versionen är stängda. Det minskar risken att en öppen läsare blandar dokument från olika versioner. Om nedladdningen misslyckas förblir den tidigare installerade versionen tillgänglig.

Extern fulltext, DocPlus-original och externa typsnitt kräver nät. Webbläsaren kan rensa lagrade filer; offlinefunktionen är därför ingen permanent arkivkopia. En ofullständig sökning visar vilka laddningsproblem som behöver åtgärdas, med möjlighet att försöka igen.

## Lokal kontroll

Webbappen kräver inget byggsteg. Testerna använder Node.js 24 och jsdom:

```sh
npm ci
npm test
python -m http.server 8765
```

Öppna `http://localhost:8765` för manuell kontroll. Testerna kontrollerar sökning, läsare, filter, laddningsfel, register/områdesfiler och service workerns cachelogik. De ersätter inte kontroll i Safari/iOS eller visuell granskning.

Vid varje släpp ska `data-v` i `index.html`, `v` i `ak_index.json` och `VERSION` i `sw.js` vara identiska. Om ett område tillkommer ska även `AREAS` i `sw.js` uppdateras.

Se [granskningen från 2026-09-20](docs/review-2026-09-20.md) för ändringar, källkontroller och återstående rekommendationer.
