# Andrew Blumson — game downloads

Reusable static download pages for native games, matching the design of [andrewblumson.com](https://andrewblumson.com/).

- Public collection: `https://downloads.andrewblumson.com/`
- CodexGun: `https://downloads.andrewblumson.com/codexgun/`
- Installers: versioned assets in the `AndrewBlumson/game-downloads` GitHub Releases area.
- The game source, signing material, internal release manifests and QA records are **not part of this public website repository**.

## Build

Use Node.js 22 or later:

```sh
npm run build
```

There are no npm dependencies, browser scripts, remote fonts, analytics or tracking cookies. Node’s standard library generates the pages. Vercel should build with `npm run build`, skip dependency installation and serve `public/` only. Deployment/domain configuration is maintained separately in `vercel.json` and the Vercel project.

## Files

- `data/games.json`: public game and release metadata.
- `scripts/build.mjs`: shared page template and static generator.
- `assets/site.css`: shared responsive design.
- `assets/fonts/`: the existing website’s Barlow Condensed and DM Sans fonts, with their licences.
- `assets/<game>/`: approved public game artwork.
- `public/`: generated output; excluded from Git.
- `releases/`: public release notes/checksum files, when present. Installers are uploaded to GitHub Releases, never committed to Git.
- `reports/`: local-only verification records; excluded from Git and website output.

## Add another game

1. Copy only approved public artwork to `assets/<game-slug>/`.
2. Add a game object to `data/games.json`, following CodexGun’s fields. Give it a unique lowercase slug, game name, copy, artwork, hardware/OS requirements, version, installer size, SHA-256 checksum and **versioned** GitHub Release URLs.
   Optionally add `wordmark: { "src": "/assets/game/wordmark.png", "alt": "Game name", "width": 1350, "height": 200 }` using the image’s actual dimensions. It appears below the game icon. `launchInstruction`, `compatibilityNote` and `signingNote` hold each game’s own controls, test coverage and signing facts; do not copy these claims without verification.
3. Keep `downloadEnabled` false while preparing the release.
4. Upload the finalized signed/notarised installer as a new GitHub Release asset. Include release notes and a `SHA256SUMS.txt` asset. Do not replace an existing version with different bytes.
5. Download the public asset anonymously, compare its full checksum and byte count, and verify installation without disabling normal platform security.
6. Only after those checks pass, set `downloadEnabled` true and rebuild. Check the actual rendered page at desktop and phone widths, the download link, canonical URL and artwork.
7. Push the approved website change through the connected Vercel workflow. Adding one metadata entry creates a collection card, a page at `/<game-slug>/`, and a sitemap entry.

The current shared template is for Apple Silicon Mac DMG releases. For Windows, Linux or different install steps, extend the platform-specific fields/template and verify the resulting instructions instead of reusing Mac instructions.

## Release updates

Update an existing game object’s version, beta label, file size, checksum, notes and release URLs. Public page URLs stay stable; installer URLs remain tied to an exact release. Preserve previous releases for traceability and rollback.

The enabled download state means the hosting verification was completed for those exact bytes. It does not claim every supported Mac or every level was tested. Keep the compatibility and beta qualifications accurate.

## Privacy

The site’s own privacy page describes only the download site: Vercel page hosting and GitHub installer delivery, with providers’ ordinary technical/security request processing. No accounts, forms, database, analytics or cookies are added by this code. Any future analytics, monitoring or storage addition requires the page to be reviewed.
