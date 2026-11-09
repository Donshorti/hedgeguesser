export function artistInitials(artist) {
  return String(artist ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s/&,-]+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .map((w) => w.match(/[\p{L}\p{N}]/u)[0].toUpperCase() + '.')
    .join(' ');
}

export function titleMask(title) {
  const clean = String(title ?? '').replace(/\s*[([].*$/, '').replace(/\s+-\s+.*$/, '').trim();
  let revealed = false;
  return [...clean]
    .map((ch) => {
      if (/[\p{L}\p{N}]/u.test(ch)) {
        if (!revealed) {
          revealed = true;
          return ch.toUpperCase();
        }
        return '_';
      }
      return ch;
    })
    .join('');
}

export function hintText(type, track) {
  switch (type) {
    case 'year':
      return track.year ? String(track.year) : 'Unknown';
    case 'genre':
      return track.genre || 'Unknown';
    case 'artistInitials':
      return artistInitials(track.artist) || '?';
    case 'firstLetter':
      return titleMask(track.title);
    default:
      return '';
  }
}
