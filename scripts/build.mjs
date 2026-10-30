import { readFile, writeFile, mkdir, rm, cp, realpath, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const actualRoot = await realpath(root);
if (/\/(Documents|Desktop|Mobile Documents)(\/|$)/.test(actualRoot)) throw new Error('Build output must remain outside iCloud folders.');
const out = resolve(root, 'public');
try {
  if ((await lstat(out)).isSymbolicLink()) throw new Error('Refusing to replace a symlinked output directory.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const site = 'https://downloads.andrewblumson.com';
const games = JSON.parse(await readFile(resolve(root, 'data/games.json'), 'utf8'));
if (!Array.isArray(games) || games.length === 0) throw new Error('Add at least one game to data/games.json.');
const slugs = new Set();
for (const game of games) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.slug) || ['privacy', 'assets'].includes(game.slug) || slugs.has(game.slug)) throw new Error('Invalid, reserved or duplicate game slug.');
  slugs.add(game.slug);
  if (!/^[a-f0-9]{64}$/.test(game.sha256)) throw new Error(`Invalid checksum for ${game.slug}.`);
  if (!Number.isSafeInteger(game.fileSizeBytes) || game.fileSizeBytes < 1) throw new Error(`Invalid file size for ${game.slug}.`);
  if (typeof game.downloadEnabled !== 'boolean') throw new Error(`Explicit downloadEnabled is required for ${game.slug}.`);
  for (const key of ['downloadUrl', 'checksumUrl', 'releaseUrl']) {
    const url = new URL(game[key]);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith('/AndrewBlumson/game-downloads/releases/')) throw new Error(`Unexpected ${key} for ${game.slug}.`);
  }
  if (!/^\/assets\/[a-z0-9/-]+\.(png|webp|jpg)$/.test(game.icon)) throw new Error(`Invalid local icon for ${game.slug}.`);
  await readFile(resolve(root, game.icon.slice(1)));
  if (game.wordmark) {
    if (!/^\/assets\/[a-z0-9/-]+\.(png|webp|jpg)$/.test(game.wordmark.src)) throw new Error(`Invalid wordmark for ${game.slug}.`);
    if (![game.wordmark.width, game.wordmark.height].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error(`Wordmark dimensions are required for ${game.slug}.`);
    await readFile(resolve(root, game.wordmark.src.slice(1)));
  }
}
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const arrow = '<span class="arrow" aria-hidden="true">↗</span>';
const version = game => `${game.version}${game.beta ? ` · Beta ${game.beta}` : ''}`;
const size = game => `${(game.fileSizeBytes / 1_000_000).toFixed(1)} MB`;
const header = `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header wrap">
  <a class="brand" href="https://andrewblumson.com/" aria-label="Andrew Blumson home"><img src="/assets/logo.png" alt="" width="43" height="40"><span>ANDREW<br>BLUMSON<small>Games &amp; cool stuff</small></span></a>
  <nav class="main-nav" aria-label="Main navigation"><a class="active" href="/">Downloads</a><a class="about-link" href="https://andrewblumson.com/#about">About Andrew</a><a class="return-link" href="https://andrewblumson.com/#games">The arcade ${arrow}</a></nav>
</header>`;
const footer = `<footer class="site-footer wrap">
  <div><span class="footer-signature">Keep making things.</span><p>Andrew Blumson · Suffolk, UK</p></div>
  <nav class="footer-links" aria-label="Footer"><a href="https://x.com/Andrew_Blumson">Follow on X ${arrow}</a><a href="mailto:hello@andrewblumson.com">Say hello ${arrow}</a><a href="/privacy/">Privacy</a></nav>
  <div class="footer-bottom"><span>© ${new Date().getUTCFullYear()} Andrew Blumson</span><span>Games, worlds &amp; a few wild ideas.</span><a href="https://adevious.co.uk/">For business, visit Adevious ↗</a></div>
</footer>`;
function page({ title, description, path, image = '/assets/logo.png', imageAlt = 'Andrew Blumson', noindex = false }, content) {
  const url = site + path;
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0e13">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow'}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Andrew Blumson · Downloads"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${site}${esc(image)}"><meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary"><meta name="twitter:site" content="@Andrew_Blumson"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${site}${esc(image)}"><meta name="twitter:image:alt" content="${esc(imageAlt)}">
<link rel="icon" href="/assets/logo.png" type="image/png"><link rel="preload" href="/assets/fonts/barlow-condensed-800.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="/assets/site.css">
</head><body>${header}${content}${footer}</body></html>\n`;
}
function download(game) {
  if (!game.downloadEnabled) return '<button class="button button-primary" disabled aria-describedby="download-status">Download coming soon <span class="arrow" aria-hidden="true">↓</span></button>';
  return `<a class="button button-primary" href="${esc(game.downloadUrl)}" aria-describedby="download-status">Download for Mac <span class="arrow" aria-hidden="true">↓</span></a>`;
}
function gamePage(game) {
  const status = game.downloadEnabled ? `Version ${esc(version(game))} &nbsp;·&nbsp; ${size(game)} &nbsp;·&nbsp; Free download` : `Version ${esc(version(game))} &nbsp;·&nbsp; Public download being verified`;
  const links = game.downloadEnabled ? `<p><a href="${esc(game.releaseUrl)}">Read the release notes ↗</a> &nbsp;·&nbsp; <a href="${esc(game.checksumUrl)}">Download checksum</a></p>` : '<p>The download will open after the hosted installer has been checked.</p>';
  return page({title:`${game.name} for Mac — Andrew Blumson`,description:`${game.name}: ${game.headline} ${game.edition} ${version(game)} for ${game.platform}, ${game.minimumOS}. Native Rust. Offline play.`,path:`/${game.slug}/`,image:game.icon,imageAlt:game.iconAlt}, `<main id="main" class="wrap">
  <a class="breadcrumb" href="/"><span aria-hidden="true">←</span> All downloads</a>
  <section class="game-hero" aria-labelledby="game-title">
    <div class="hero-copy"><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>${esc(game.edition)} / Native edition</p><h1 id="game-title">${esc(game.name)}</h1><p class="tagline">${esc(game.headline)}</p><p class="hero-description">${esc(game.description)}</p>
      <div class="release-badges"><span>${esc(game.platformShort)}</span><span>${esc(game.minimumOS)}</span><span>Offline play</span></div>
      ${download(game)}<p class="download-meta" id="download-status">${status}</p><p class="requirements-note">For ${esc(game.hardware)} Macs. This download does not run on Intel Macs, iPhone, iPad or Windows.</p>
    </div>
    <div class="hero-art"><img src="${esc(game.icon)}" width="640" height="640" alt="${esc(game.iconAlt)}" fetchpriority="high">${game.wordmark ? `<img class="game-wordmark" src="${esc(game.wordmark.src)}" alt="${esc(game.wordmark.alt || game.name)}" width="${game.wordmark.width}" height="${game.wordmark.height}">` : ''}<p class="art-caption"><span>Made by Andrew Blumson</span><span>Built in Rust · Made to play</span></p></div>
  </section>
  <section class="feature-strip" aria-label="About the game">${game.features.map((feature,index)=>`<div class="feature"><span class="feature-index" aria-hidden="true">0${index+1}</span><h2>${esc(feature.title)}</h2><p>${esc(feature.description)}</p></div>`).join('')}</section>
  <div class="lower-grid">
    <section aria-labelledby="install-title"><p class="eyebrow muted">A few steps to takeoff</p><h2 class="section-heading" id="install-title">Install. Launch.<br><span class="accent">Make it yours.</span></h2>
      <ol class="steps"><li><span class="number" aria-hidden="true">01</span><div><h3>Open the downloaded DMG.</h3><p>A disk containing ${esc(game.name)} will open.</p></div></li><li><span class="number" aria-hidden="true">02</span><div><h3>Drag ${esc(game.name)} into Applications.</h3><p>Wait for the copy to finish, then eject the installation disk.</p></div></li><li><span class="number" aria-hidden="true">03</span><div><h3>Open the game from Applications.</h3><p>${esc(game.launchInstruction || 'Follow the controls shown in the game.')}</p></div></li></ol>
      <p class="compatibility">Requires an ${esc(game.platform)} (${esc(game.hardware)}) with ${esc(game.minimumOS)}. ${esc(game.compatibilityNote || 'Check the hardware and operating-system requirements before downloading.')}</p>
    </section>
    <section class="feedback" aria-labelledby="feedback-title"><p class="eyebrow muted">A beta is better together</p><h2 class="section-heading" id="feedback-title">Play a little.<br><span class="accent">Tell me a lot.</span></h2><p>Play a few levels and tell me how it feels. If you find a problem, <strong>reply to the X post that shared this download</strong>.</p><p>Include your Mac model, macOS version, the level and what happened. A screenshot or short recording helps.</p><p>This is a public beta. Bugs and differences from the browser edition may still be present.</p><a class="text-link" href="https://x.com/Andrew_Blumson">Find Andrew on X ${arrow}</a>${game.signingNote ? `<p class="compatibility">${esc(game.signingNote)}</p>` : ''}</section>
  </div>
  <details class="release-details"><summary>Release details &amp; file verification</summary><div class="release-content"><div><p class="eyebrow">${esc(game.name)} / ${esc(version(game))}</p><p>${esc(game.releaseSummary)}</p>${links}</div><div><p>${size(game)} · ${game.fileSizeBytes.toLocaleString('en-GB')} bytes · DMG installer</p><p>SHA-256<span class="checksum">${esc(game.sha256)}</span></p><p class="verified-note">${game.downloadEnabled ? 'The public download has been checked against this checksum.' : 'This is the checksum of the final signed installer.'}</p></div></div></details>
</main>`);
}
function catalogue() {
  return page({title:'Game downloads — Andrew Blumson',description:'Native games from Andrew Blumson. Download Mac editions, play offline and help shape the next release.',path:'/',image:games[0].icon,imageAlt:games[0].iconAlt}, `<main id="main" class="wrap"><section class="catalogue-hero" aria-labelledby="downloads-title"><div><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>The arcade / Beyond the browser</p><h1 id="downloads-title">Your next world.<br><span class="accent">Offline.</span></h1></div><p>Games to keep on your Mac.<br>Pick a world, download it and make yourself at home.</p></section><section class="catalogue-list" aria-label="Available games">${games.map(game=>`<article class="game-card"><a class="card-art" href="/${game.slug}/" aria-label="View ${esc(game.name)}"><img src="${esc(game.icon)}" alt="" width="640" height="640"></a><div><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>${esc(game.edition)}</p><h2><a href="/${game.slug}/">${esc(game.name)}</a></h2><p>${esc(game.shortDescription)}</p><p class="card-meta">${esc(game.platformShort)} &nbsp;·&nbsp; ${esc(version(game))} &nbsp;·&nbsp; ${size(game)}</p></div><div class="card-action"><a class="button button-primary" href="/${game.slug}/">View download ${arrow}</a></div></article>`).join('')}</section></main>`);
}
const privacy = page({title:'Download site privacy — Andrew Blumson',description:'How the Andrew Blumson downloads website and its hosting providers handle information.',path:'/privacy/'}, `<main id="main" class="wrap"><article class="text-page"><p class="eyebrow muted">The small print</p><h1>Your privacy.</h1><p>This page explains the downloads website at downloads.andrewblumson.com. It is run by Andrew Blumson. For questions, email <a href="mailto:hello@andrewblumson.com">hello@andrewblumson.com</a>.</p><h2>A simple download site.</h2><p>This website has no accounts, contact forms, analytics, advertising, tracking pixels or database. It does not set cookies or use browser storage. Fonts and artwork are served with the site.</p><h2>Hosting and downloads.</h2><p><strong>Vercel</strong> hosts these pages. <strong>GitHub</strong> hosts the installers and release information. These providers process technical request information, such as IP addresses, requested URLs, browser details and timestamps, to deliver and protect their services. This site’s operator does not add visitor tracking.</p><p>A download button takes you directly to GitHub’s release service. GitHub may apply its own cookies and policies when you visit its website. See <a href="https://vercel.com/legal/privacy-policy">Vercel’s privacy notice</a> and <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub’s privacy statement</a> for their handling of information.</p><h2>Links and feedback.</h2><p>Links to X, andrewblumson.com and Adevious take you to separate websites with their own privacy information. If you contact Andrew, the information you send is used to respond to you or investigate your feedback. Avoid sending passwords or other sensitive information in public bug reports.</p><h2>The games themselves.</h2><p>This notice covers the download website. A game may have its own privacy information or requirements. Check its release notes and any notices inside the game.</p><h2>Keeping this page current.</h2><p>This notice will be updated if services or data handling change. Last updated: 30 October 2026.</p><a class="text-link" href="/">Back to downloads ${arrow}</a></article></main>`);
const notFound = page({title:'Page not found — Andrew Blumson',description:'This download page could not be found.',path:'/404.html',noindex:true}, `<main id="main" class="wrap"><section class="text-page error-page"><p class="eyebrow muted">404 / Wrong turn</p><h1>That world<br><span class="accent">isn’t here.</span></h1><p>The link may have changed. Head back to the download collection to find your next game.</p><a class="button button-primary" href="/">All downloads ${arrow}</a></section></main>`);

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(resolve(root,'assets'),resolve(out,'assets'),{recursive:true});
await writeFile(resolve(out,'index.html'),catalogue());
await mkdir(resolve(out,'privacy'),{recursive:true});
await writeFile(resolve(out,'privacy/index.html'),privacy);
await writeFile(resolve(out,'404.html'),notFound);
for (const game of games) {
  await mkdir(resolve(out,game.slug),{recursive:true});
  await writeFile(resolve(out,game.slug,'index.html'),gamePage(game));
}
await writeFile(resolve(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(resolve(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/privacy/',...games.map(game=>`/${game.slug}/`)].map(path=>`<url><loc>${site}${path}</loc></url>`).join('')}</urlset>\n`);
console.log(`Built ${games.length} game page(s), catalogue, privacy and 404 pages in public/.`);
console.log(`Download state: ${games.map(game=>`${game.slug}=${game.downloadEnabled?'enabled':'verification pending'}`).join(', ')}`);
