# Akutkompassen – webbapp (v10, version ak-v10s4-cf)

Nytt i v10: appen är uppdelad i en liten startsida och separata datafiler per område (`ak_*.json`). Den öppnar direkt, hämtar PM-texten i bakgrunden och fungerar offline efter första besöket. Svenska och internationella riktlinjer visas som länkar till utgivaren. Deras fulltext lagras inte i appen och kräver internet; titlar, beskrivningar och sökord är sökbara lokalt.

## Gränssnitt ak-v10s4-cf

Startsidan skiljer mellan **Lokala PM** (Region Uppsala / DocPlus) och **Externa riktlinjer** (svenska och internationella utgivare). Källtypen syns även i sökresultat, sparade dokument och läsvyn. Indelningen i kärn-PM och andra linjen har tagits bort, liksom dess påverkan på sortering och sökpoäng. Områdeslistor sorteras alfabetiskt. Dokumentregistret och källtexterna är oförändrade.

Gränssnittet har tydligare källfilter, luftigare kort och mobilanpassad layout. Texten ”Riktlinjer är ett stöd och ersätter inte klinisk bedömning” har senare tagits bort från startsidan.

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


## Barnsektion – 23 september 2026

`/barn/` är ett separat sökbart bibliotek med 60 biblioteksposter: 31 lokala Akademiska/Region Uppsala-PM, 5 Karolinska-poster och 24 externa kunskapsstöd. Cystisk fibros samlar sju Karolinska-PM i en post under Lungsjukdomar; totalt finns fortfarande 66 källänkar. Sökning omfattar metadata och sökord, inte medicinsk fulltext. Favoriter lagras separat under `ak.barn.saved`.

`barn/data.json` innehåller dokumentdatum när verifierbart, avsändare, område och datum för länkkontroll. Datumet för länkkontroll är inte medicinsk granskning. Karolinska-PM kan vara publicerade via specialistföreningar; de attribueras till sjukhuset. Inga lokala PDF-filer har kopierats eller publicerats. Ytterligare 27 bibliotekskopior har identifierats men hålls utanför webbplatsen tills offentlig publicering har godkänts.

Barnsidan länkar direkt till original-PDF:er och riktlinjesidor. Vid ändringar uppdateras `barn/data.json`, `index.html`/`ak_index.json` och cacheversionen i `sw.js`. Service worker cachelagrar barnsidan och dess register, men aldrig externa källdokument.

### Rättningar 23 september 2026 (ak-v10s4e)

- "Skallskador" (swepem-15) pekade på SWEPEM:s sida för patientmaterial; pekar nu på SNC:s skandinaviska riktlinje för skallskador hos barn (PDF, Läkartidningen 2017).
- Osteomyelit/septisk artrit (Akademiska) och Led- och skelettinfektioner (ALB) flyttade från Trauma & ortopedi till Feber & infektion.
- 14 SWEPEM-poster länkar nu direkt till dokumentet (PDF) i stället för föreningens landningssida, med dokumentdatum och utgivare (BLF Allergi & lung, BSFI, SNPF). Anafylaxi barn pekar på BLF-AL:s riktlinje rev 2026-08-21 i stället för SFFA:s fickformat.
- Sökningen tål böjningar ("kramper" hittar "kramp", "feberkramper" hittar "feberkramp").
- Fokus stannar på valt område efter klick (tangentbord/skärmläsare).
- Dokumentspecifika sökord för krupp, bronkiolit, meningit, feberkramp, epilepsi, akut skrotum, ormbett, LAST och hyponatremi.

## 23 september 2026 – Barn (ak-v10s4f)

- Barnbiblioteket utökat från 60 till 94 dokument: nationella PM från BLF:s sektioner (endokrin/diabetes, nefrologi, reumatologi, hematologi/onkologi, kardiologi, neuropediatrik, neonatal), HLR-rådet, Löf, Läkemedelsverket, SWESEM, NPO kirurgi och Socialstyrelsen. Alla länkar går direkt till PDF hos utgivaren (kontrollerade 2026-09-23).
- Borttaget: Svampinfektioner barn (BOT), Abstinens efter sedering (BIVA), samlingssidan för cystisk fibros (`barn/cystisk-fibros.html`) och neonatalföreningens listsida – ersatt av konkreta neonataldokument.
- SWEPEM-poster länkar nu direkt till PDF; sökningen tål böjningsformer (t.ex. "kramper" hittar "kramp").
- Sparade favoriter som pekar på borttagna dokument rensas automatiskt.

## Gemensam design
Vuxen- och barnbiblioteket använder `shared.css` för samma sidhuvud, sökpanel, navigering, kort och mobilbrytpunkter. Vuxensidans läsare och fulltextsökning behålls; äldre läsarstilar ligger i ett separat CSS-lager.

## Dokumentetiketter – 27 september 2026

`NY!` avser dokumentets publicerings- eller godkännandedatum under de senaste 12 månaderna, inklusive årsdagen (UTC). `publishedOn` har företräde, därefter barnbibliotekets `date`, därefter vuxenbibliotekets `yr`. Exakta godkännandedatum har hämtats ur de befintliga PM-texternas fält ”Godkänt den”; riktlinjedatum kan anges i `publishedOn`. När endast årtal finns kvalificerar innevarande år, men föregående år behöver ett exakt datum för att styrka att dokumentet är yngre än ett år. Framtida, ogiltiga och saknade datum ger ingen etikett. Tilläggsdatum och länkkontroll påverkar aldrig etiketten.

`POPULÄR!` ersätter den gula cirkeln och visas för samma områdesledare baserat på gemensamma öppningar. Noll eller otillgänglig statistik ger ingen popularitetsetikett. Båda etiketterna kan visas samtidigt i kort, sparade urval och sökresultat.

## Kompass / Original – utseende

Den nya visuella stilen ligger separat i `appearance.css` och aktiveras enbart av `html[data-look=kompass]`. Originalets `shared.css` och läsarstilar är oförändrade. Kompass är numera det enda utseendet; växeln **Utseende → Original** i sidhuvudet är borttagen.

För att återställa originalet som standard för nya besökare: ändra `DEFAULT_LOOK` till `original` i `appearance.js`. För en fullständig återställning till originaldesignen för alla: ta bort de två `appearance`-referenserna i båda HTML-sidorna och publicera med en ny cacheversion. Förra versionen finns i Git som `5a5ef4d`. Ingen extern font eller bild behövs för det nya utseendet.

## 27 september 2026 – riktlinjer och akutrumsblad

DAS 2015 ersatt av 2025 med bibehållet GL54-ID. Tillagt SILF endokardit revision 2025, ESICM vätskeval och tydligt märkt visuell chocksammanfattning, ESVS kärltrauma, fulltextlänkar för ESO basilaris/SAH, JBDS HHS, ACEP agitation, GIC paracetamol/metanol samt tio ANZCOR-kapitel. Externa riktlinjer förblir länkar till källor.

Barnbiblioteket har en lokal PDF-sammanställning av 16 offentliga Word-källblad från SWEPEM/Karolinska. Innehållsrutornas text har satts om eftersom direktkonverteringen klippte innehåll. Kliniska uppgifter och källversioner har inte uppdaterats. Samlingen är markerad som äldre bibliotekskopia; sammanställningsdatum används inte för NY!-etiketten. Originalkällan anges i PDF och metadata.

WMS Drowning 2024 och WMS Heat Illness 2024 tillagda med länkar till utgivaren. Original-PDF:erna är sparade i ED Consultant.


## Länkkontroll och uppdatering 1 oktober 2026 (ak-v10s26-okt-lankkontroll)

Rättade länkar: 20808 Meningit och encefalit (nu DocPlusSTYR-14040), GL65 GIC Antidotlista, GL122 Löf massivt transfusionsprotokoll.

Borttagna, finns inte längre i publika DocPlus: 49801 Tyreotoxikos, 13720 Akuta larm, 196 Patientinformation hjärnskakning, 15224 Beredskapsplan, 27553 Beslut- och hänvisningsstöd triage.

Uppdaterad fulltext: 22759 Omhändertagande efter hjärtstopp, CIVA (version 9, godkänd 2026-09-29). Provtagningsschemat på sidan 8–9 är återgivet som text.

Nya länkar vuxna (GL127–GL134): HLR-rådets sammanfattning 2026, A-HLR vuxen, HLR vid trauma, drunkning, luftvägsstopp, Hjärtstopp inom hälso- och sjukvården, SFAI neuraxiala blockader och antitrombotiska läkemedel, nationellt vårdprogram gallstenssjukdom.

Nya länkar barn: Perinatal stroke, Bi- och getingstick, Trombolys till barn och ungdomar, Spontan pneumothorax. Vårdprogram Borrelia har fått datum 2026-08-31.

`tracking/documents.json` är uppdaterad; popularitetsräknaren räknar de nya dokumenten först när Cloudflare-workern har driftsatts på nytt.

## Rättningar 1 oktober 2026 (ak-v10s27-sokordning)

Sökresultat sorteras nu efter relevans i både Vuxna och Barn; popularitet avgör bara vid lika poäng. Startsidan visar 24 dokument med knappen ”Visa alla”. GL111 (AHA/ACC lungemboli 2026) länkar till DOI-adressen hos Circulation. Kortet för Meningit och encefalit visar DocPlus-numret från länken (STYR-14040). Läsarens z-index är höjt, undertiteln i sidhuvudet är större på smal skärm och rubriken ”PM & riktlinjer” har luftigare teckenavstånd.
