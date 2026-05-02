// Renders an on-hand value as both base units and (when the product comes in
// a case) the equivalent case count. Treats any pack size <= 1 as plain
// eaches so legacy products without a configured pack are unaffected.
//
//   formatStockDisplay(144, 24)            → "144 each (6 cases of 24)"
//   formatStockDisplay(150, 24)            → "150 each (6 cases of 24 + 6)"
//   formatStockDisplay(5,   1)             → "5 each"
//   formatStockDisplay(5,   1, "kg")       → "5 kg"

export function formatStockDisplay(
  onHand: number,
  packSize: number | null | undefined,
  unitLabel = "each",
): string {
  const pack = packSize ?? 1;
  if (pack <= 1) return `${onHand} ${unitLabel}`;

  const cases = Math.floor(onHand / pack);
  const remainder = onHand % pack;
  const casesLabel = `${cases} case${cases === 1 ? "" : "s"} of ${pack}`;

  if (remainder === 0) return `${onHand} ${unitLabel} (${casesLabel})`;
  return `${onHand} ${unitLabel} (${casesLabel} + ${remainder})`;
}
