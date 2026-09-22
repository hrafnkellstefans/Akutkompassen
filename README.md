# Akutkompassen – webbapp (v10, version ak-v10s2e)

Nytt i v10: appen är uppdelad i en liten startsida och separata datafiler per område (`ak_*.json`). Den öppnar direkt, hämtar PM-texten i bakgrunden och fungerar offline efter första besöket. Svenska och internationella riktlinjer visas som länkar till utgivaren. Deras fulltext lagras inte i appen och kräver internet; titlar, beskrivningar och sökord är sökbara lokalt.

## Riktlinjer tillagda 22 september 2026

Sex källänkar har verifierats hos utgivarna. Inga nya behandlingssammanfattningar eller doseringar har införts.

| ID | Dokument | Verifierad version |
|---|---|---|
| GL82 | UKKA: akut hyperkalemi hos vuxna | Uppdaterad juli 2026, 180 sidor |
| GL83 | RCC: nationellt vårdprogram akut onkologi | 2.0, 2026-02-10 |
| GL84 | RCC: biverkningar av checkpointhämmare | 1.2, 2026-06-23 |
| GL85 | NPO Ögon: lathund akut trångvinkelattack | Bilaga B, 2026 |
| GL86 | NPO Ögon: periorbitala och orbitala infektioner | 2022-02-07, offentlig webbversion |
| GL87 | LÖF: akut stopp i trakealkanyl, barn och vuxna | Fickkort 2021 |

Källadresser, verifieringsdatum och svenska sökord finns i `ak_index.json`. Etiketten Nationellt skiljer de nya svenska kunskapsstöden från internationella riktlinjer. Områdena HEM och URO har fått tydligare namn; befintliga dokument-ID:n och sparade favoriter behålls.

Kontrollera sökningen med `node --test tests/search.test.cjs`. Testerna använder appens sökmotor och kontrollerar de nya sökorden både före och efter inläsning av PM-text.

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
