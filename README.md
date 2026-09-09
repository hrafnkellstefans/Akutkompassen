# Akutkompassen – webbapp

Allt som behövs ligger i den här mappen:

| Fil | Vad |
|---|---|
| `index.html` | Hela appen (PM-text, sök, läsare) i en fil |
| `manifest.webmanifest` | Gör att den kan installeras som app med ikon |
| `sw.js` | Gör att appen fungerar offline efter första besöket |
| `icon-*.png`, `apple-touch-icon.png`, `favicon.png` | Ikoner (din logga) |

## Publicera på GitHub Pages (en gång)

1. Skapa konto på https://github.com (gratis).
2. Klicka **+** uppe till höger → **New repository**. Namn: `akutkompassen`. Välj **Public**. Bocka i **Add a README file**. **Create repository**.
3. I det nya repot: **Add file → Upload files**. Dra in alla filer i den här mappen (inte mappen själv). **Commit changes**.
4. **Settings** (fliken högst upp) → **Pages** i vänstermenyn → under *Build and deployment* välj **Source: Deploy from a branch**, **Branch: main / (root)** → **Save**.
5. Vänta 1–2 minuter, ladda om sidan – adressen visas högst upp: `https://<ditt-användarnamn>.github.io/akutkompassen/`

Skicka den adressen till chefen. På iPhone: öppna i Safari → Dela → **Lägg till på hemskärmen**. Den får din logga som ikon och öppnas i helskärm.

## Uppdatera appen

Ladda upp en ny `index.html` på samma sätt (Add file → Upload files, den ersätter den gamla). Ändra `VERSION` i `sw.js` (t.ex. `ak-v2`) så att alla telefoner hämtar den nya versionen.

## Obs

Repot är publikt (krav för gratis GitHub Pages). Innehållet är text ur offentliga DocPlus-PDF:er samt ditt urval – inga patientdata, inga interna dokument. Vill du ha det privat kostar GitHub Pro ca 4 USD/mån och ger Pages på privata repon.
