// Rules shared by tools/build-seo.mjs and tests/seo.test.cjs (one place, so they cannot disagree).

// A document whose text reserves its copyright or forbids copying ("©", "Mångfaldigande ... förbjudet",
// "upphovsrätt" ...) gets no page of its own for search engines: it is listed as title + link only.
const RESERVED = /©|copyright|upphovsrätt|eftertryck|mångfaldigande[^.]{0,250}förbjud|får (inte|ej) (kopieras|mångfaldigas|spridas|återges)|all rights reserved|med ensamrätt/i;

// The search pages are read by search engines, so e-mail addresses and mobile numbers in PM texts
// are shown only in the original (the app still shows the full text). Text is normalised to NFC,
// so "å" is one character everywhere.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MOBILE = /(?:\+46\s?|\b0)7[02369](?:[\s-]?\d){7}\b/g;
const redact = s => String(s).normalize('NFC').replace(EMAIL, '[e-postadress i originalet]').replace(MOBILE, '[mobilnummer i originalet]');

module.exports = {RESERVED, redact};
