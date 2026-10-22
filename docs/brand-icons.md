# Browser icon maintenance

The supplied original CZ artwork is the source of truth. Do not recolour, crop,
enlarge, or replace it to work around browser presentation.

## One declaration

`views/partials/brand-icons.ejs` declares the ICO, PNG, and Apple touch icon for
every page. Templates include it. `lib/brand-icons.js` reads that same declaration
for backend HTML rewriting and legacy asset compatibility. Do not add separate
favicon declarations to individual templates or middleware.

The current versioned images are byte-identical copies of the original assets.
Once a versioned filename is published, never overwrite its contents: canonical
responses are immutable. An authorized future artwork update needs new filenames
and one change to the shared declaration.

## Legacy URLs

`middleware/static-files.js` resolves historical root favicon names and withdrawn
icon trials through `lib/brand-icons.js`. They serve the original image bytes with
`Cache-Control: no-store`, not a redirect and not the withdrawn file. The temporary
comparison page returns HTTP 410. Old files remain recoverable for rollback but
are not served through their previous trial URLs.

Before declaring a production deployment verified, check the public HTTPS paths
as well as Node locally. Nginx must not bypass these compatibility handlers or
override their cache headers. Check the naked, www, and admin hostnames.

## Safari limits and acceptance

The user confirmed that the same Safari tab loses its extra white frame when the
macOS appearance changes from dark to light without a reload. The original image
has no white boundary pixels. This locates that frame in Safari's appearance
handling; no website-side switch for that treatment has been verified.

Do not claim that serving the correct image forces Safari's existing local icon
database to update. Server-side canonicalization prevents subsequent requests
from returning withdrawn artwork; existing browser-selected representations are
a separate acceptance check. Do not clear all Safari data or change the logo as
a substitute for verification.

## Validation

Run `node --test tests/brand-icons.test.js tests/static-files.test.js
tests/admin-domain.test.js`, and the full suite after broad template edits.
The tests enforce a single declaration, compile templates, compare legacy and
canonical response bodies on all three hosts, verify cache headers and test-page
retirement, and protect unrelated image routes and private files.
