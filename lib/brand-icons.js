const fs = require('node:fs');
const path = require('node:path');

// One declaration for student templates and backend response rewriting.
// Keep the original artwork and the current versioned URLs unchanged.
const markup = fs.readFileSync(path.join(__dirname, '../views/partials/brand-icons.ejs'), 'utf8').trim();
const links = [...markup.matchAll(/<link\b[^>]*>/g)].map(([tag]) => {
  const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
  return attrs;
});
const ico = links.find(link => link.type === 'image/x-icon').href;
const png = links.find(link => link.type === 'image/png').href;
const touch = links.find(link => link.rel === 'apple-touch-icon').href;
const canonical = new Set([ico, png, touch]);

function legacyTarget(url) {
  if (/^\/(?:favicon(?:-[\w-]+)?\.(?:ico|png|svg)|apple-touch-icon(?:-[\w-]+)?\.png)$/.test(url)) {
    if (url.endsWith('.ico')) return ico;
    if (url.endsWith('.svg')) return '/public/images/brand-green/app-rounded.svg';
    return /apple-touch-icon|(?:180|192)/.test(url) ? touch : png;
  }
  // Withdraw all previous favicon trials, including URLs retained by browsers.
  if (/^\/public\/images\/brand-green\/(?:backend-(?:icon|solid|contrast)-202610(?:19|20)|favicon-compact-test-20261020)(?:-(?:32|180))?\.(?:ico|png|svg)$/.test(url)) {
    if (url.endsWith('.svg')) return '/public/images/brand-green/app-rounded.svg';
    return url.endsWith('.ico') ? ico : /-180\.png$/.test(url) ? touch : png;
  }
  return null;
}

module.exports = { markup, ico, png, touch, canonical, legacyTarget };
