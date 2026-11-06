// Empirical statistics. Use every revealed ending, never the 200 display paths.
export function probabilities(values, threshold) {
  if (!values.length) return { above: 0, below: 0, equal: 0 };
  let above = 0,
    below = 0;
  for (const value of values) {
    if (value > threshold) above++;
    else if (value < threshold) below++;
  }
  return {
    above: above / values.length,
    below: below / values.length,
    equal: (values.length - above - below) / values.length,
  };
}

export function histogram(values, low, high, count = 40) {
  const width = (high - low) / count;
  const bins = Array.from({ length: count }, (_, i) => ({
    low: low + i * width,
    high: low + (i + 1) * width,
    count: 0,
  }));
  for (const value of values) {
    const index = Math.max(
      0,
      Math.min(count - 1, Math.floor((value - low) / width)),
    );
    bins[index].count++;
  }
  return bins;
}

export function priceDomain(result, history = []) {
  let low = result.starting_price,
    high = low;
  const include = (value) => {
    low = Math.min(low, value);
    high = Math.max(high, value);
  };
  result.ending_prices.forEach(include);
  result.sample_paths.forEach((path) => path.forEach(include));
  Object.values(result.percentile_paths).forEach((path) =>
    path.forEach(include),
  );
  history.forEach((p) => include(p.close));
  const pad = Math.max((high - low) * 0.06, result.starting_price * 0.015);
  return [Math.max(0, low - pad), high + pad];
}
