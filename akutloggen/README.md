# Akutloggen

Standalone Swedish ST logbook, served from `akutloggen/index.html`. No build step is required. Run a local static server at the repository root to preview it.

## Data compatibility

The public site keeps records in this browser's `localStorage`, under the existing `akutloggen-v1` key. It does not sync across devices. Existing IDs, historical shift labels, and unspecified procedure roles are preserved. Only explicitly performed clinical procedures count toward performed totals; assistance, simulation and unspecified historical roles are shown separately. Counts are exposure evidence, not certification of competence.

JSON backup version 2 includes cases, assessments, settings, favorites, individual targets, EPA/delmål state and the current draft. Version 1 backups remain accepted. Import previews conflicts and defaults to keeping existing records; importing settings or a draft requires separate selection. A failed local record write must not report success. Download messages confirm that downloading started, not that the user has retained the file.

The legacy Claude embedding integration remains optional and is not active on the standalone public site. Its database import is not supported by the new atomic local import flow. Do not put identifiable patient information in this logbook.

## Training references

The skills are a selection from [SWESEM core curriculum, 2023-08-02](https://slf.se/swesem/app/uploads/2023/08/SWESEM-Core-curriculum-230802.pdf), not the complete curriculum. Combined skills have separate technique/site targets where needed: chest drains, arthrocentesis, nail procedures, epistaxis, direct-laryngoscopy RSI and joint reduction. A clinician can set an individual overall goal without altering the reference subtargets. The Malmö yearly plan is optional and off by default. Self-assessment, supervision level and workplace assessment scores are distinct scales. Adapted assessment forms do not replace a clinic's required signed forms.

## Tests

Use Node.js 22 or later:

```sh
npm ci
npm test
# Only the logbook:
npm run test:akutloggen
```

Tests cover persistence and failure handling, quick logging, draft recovery, editing, historical records, counting, backup validation and conflict handling, date-filtered PDF/Excel export, and automated accessibility checks across the main views. Export tests use the same pinned library versions as the browser page. The SheetJS package comes from its official CDN because the npm registry release is older.

Manual checks include 320 px and 390 px layouts, quick logging and reload recovery. Axe checks run in jsdom, with color-contrast detection disabled; they do not establish full WCAG conformance. Real iOS/Android, VoiceOver/TalkBack, offline behavior and the optional embedded Claude integration still require device/integration testing.
