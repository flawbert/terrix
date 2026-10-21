export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatArea(areaSqMeters: number): string {
  if (!areaSqMeters || areaSqMeters <= 0) return '0 m²';
  const hectares = areaSqMeters / 10000;
  const formattedSqm = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(areaSqMeters);

  if (hectares >= 0.1) {
    return `${formattedSqm} m² (${hectares.toFixed(2)} ha)`;
  }
  return `${formattedSqm} m²`;
}

export function formatDistance(meters: number): string {
  if (meters < 0) return '0 m';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km (${Math.round(meters).toLocaleString('en-US')} m)`;
  }
  return `${Math.round(meters).toLocaleString('en-US')} m`;
}
