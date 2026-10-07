/** Code 39 patterns: 9 elements per character (bar, space, bar ...), 'w' wide and 'n' narrow. */
const PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

/** A Code 39 barcode of `value` (characters outside the Code 39 set are skipped), with the value beneath it. */
function Code39Barcode({ value, height = 40 }: { value: string; height?: number }) {
  const text = value.toUpperCase().split('').filter((ch) => ch !== '*' && PATTERNS[ch]).join('');
  const narrow = 1.5;
  const wide = 3.5;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of `*${text}*`) {
    PATTERNS[ch].split('').forEach((el, i) => {
      const w = el === 'w' ? wide : narrow;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    });
    x += narrow; // gap between characters
  }
  return (
    <svg role="img" aria-label={`Barcode ${text}`} viewBox={`0 0 ${x} ${height + 14}`} style={{ width: 150, maxWidth: '100%' }}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
      <text x={x / 2} y={height + 11} textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor">
        {text}
      </text>
    </svg>
  );
}

export default Code39Barcode;
