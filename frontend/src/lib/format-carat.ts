export function formatCarat(value: number) {
  const milliCarat = Math.round(Number(value) * 1000)
  const decimalPlaces = Math.abs(milliCarat % 10) === 0 ? 2 : 3
  return (milliCarat / 1000).toFixed(decimalPlaces)
}
