const VERSION_TAIL =
  /\s+-\s+.*\b(live|remaster(ed)?|version|edit|mix|mono|stereo|acoustic|demo|radio|single|bonus)\b.*$/i;
const FEAT_TAIL = /\s*\b(feat\.?|ft\.?|featuring)\s.*$/i;
const BRACKETED = /[([][^)\]]*[)\]]/g;
const FEAT_BRACKET = /[([]\s*(feat\.?|ft\.?|featuring)\s[^)\]]*[)\]]/gi;

function base(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function clean(t) {
  return t
    .replace(/['’‘`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '');
}

/** Generic text normalization (artists, search). */
export function normalizeText(s) {
  return clean(base(s));
}

/** All acceptable normalized forms of a song title, primary form first. */
export function titleVariants(title) {
  const b = base(title).replace(VERSION_TAIL, '');
  const stripped = clean(b.replace(BRACKETED, ' ').replace(FEAT_TAIL, ''));
  const full = clean(b.replace(FEAT_BRACKET, ' ').replace(FEAT_TAIL, ''));
  return [...new Set([stripped, full].filter(Boolean))];
}

/** Primary normalized title. */
export function normalizeTitle(title) {
  return titleVariants(title)[0] ?? '';
}
