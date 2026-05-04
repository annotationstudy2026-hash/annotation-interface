# Image Annotation Study

Static GitHub Pages annotation UI.

## Google Sheet

1. Create a Google Sheet with the account that should own the responses.
2. Open `Extensions` -> `Apps Script`.
3. Copy `google_apps_script/Code.gs` into Apps Script.
4. Click `Deploy` -> `New deployment` -> `Web app`.
5. Set `Execute as` to `Me`.
6. Set `Who has access` to `Anyone`.
7. Deploy and copy the Web App `/exec` URL.

## Deploy

1. Put the Google Apps Script Web App URL in `docs/config.js`.
2. Commit and push this repository.
3. In GitHub, open `Settings` -> `Pages`.
4. Set `Source` to `Deploy from a branch`.
5. Set branch to `main` and folder to `/docs`.

If `docs/config.js` has an empty `webAppUrl`, answers are still saved in browser
localStorage and can be exported with the `CSV 백업` button, but they will not be
sent to Google Sheet.

Annotator links:

```text
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_01
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_02
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_03
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_04
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_05
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_06
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_07
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_08
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_09
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_10
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_11
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_12
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_13
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_14
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_15
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_16
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_17
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_18
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_19
https://annotationstudy2026-hash.github.io/annotation-interface/?annotator=annotator_20
```

`annotator_11` receives the same items as `annotator_01`, `annotator_12` receives
the same items as `annotator_02`, and so on through `annotator_20` /
`annotator_10`.
