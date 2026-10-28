export function calcDesktopSizes(baseRem: number) {
  const compact = baseRem === 2.5 || baseRem === 2.25;
  const minimumParagraph = 0.9375;
  const step = 0.0625;
  const h6 = compact ? 1.125 : Math.max(baseRem - 1.75, minimumParagraph);
  const h5 = Math.max(baseRem - (compact ? 1 : 1.5), h6 + step);
  const h4 = Math.max(baseRem - (compact ? 0.75 : 1.25), h5 + step);
  const h3 = Math.max(baseRem - (compact ? 0.5 : 1), h4 + step);
  const h2 = Math.max(baseRem - (compact ? 0.25 : 0.5), h3 + step);
  const h1 = Math.max(baseRem, h2 + step);

  return [h1, h2, h3, h4, h5, h6, h6].map((rem, index) => ({
    label: ['H1 (Topic Title)', 'H2', 'H3', 'H4', 'H5', 'H6', 'Paragraph'][index],
    size: rem.toFixed(4).replace(/\.?0+$/, ''),
    px: Math.round(rem * 16),
  }));
}
