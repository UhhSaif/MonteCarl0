import test from "node:test";
import assert from "node:assert/strict";
import {
  histogram,
  probabilities,
  priceDomain,
} from "../src/utils/simulation.js";

test("probabilities use strict comparisons and include ties", () => {
  assert.deepEqual(probabilities([90, 100, 100, 110], 100), {
    above: 0.25,
    below: 0.25,
    equal: 0.5,
  });
  assert.deepEqual(probabilities([], 100), { above: 0, below: 0, equal: 0 });
  assert.equal(probabilities([1, 2, 3], 10).above, 0);
  assert.equal(probabilities([1, 2, 3], 0.5).above, 1);
});
test("histogram includes both edges and conserves every trial", () => {
  const bins = histogram([0, 1, 2, 3, 4], 0, 4, 4);
  assert.deepEqual(
    bins.map((b) => b.count),
    [1, 1, 1, 2],
  );
  assert.equal(
    bins.reduce((n, b) => n + b.count, 0),
    5,
  );
});
test("partial reveal uses only revealed trials", () => {
  const ends = [10, 20, 30, 40];
  assert.equal(probabilities(ends.slice(0, 2), 25).above, 0);
  assert.equal(probabilities(ends, 25).above, 0.5);
  assert.equal(
    histogram(ends.slice(0, 2), 0, 50).reduce((n, b) => n + b.count, 0),
    2,
  );
});
test("price scale includes sample excursions, history, and all endings", () => {
  const [low, high] = priceDomain(
    {
      starting_price: 100,
      ending_prices: [50, 200],
      sample_paths: [[100, 250, 200]],
      percentile_paths: { p50: [100, 120] },
    },
    [{ close: 40 }],
  );
  assert.ok(low < 40 && high > 250);
});
test("flat distributions still have a finite nonzero chart range", () => {
  const [low, high] = priceDomain({
    starting_price: 100,
    ending_prices: [100],
    sample_paths: [[100, 100]],
    percentile_paths: { p50: [100, 100] },
  });
  assert.ok(low < 100 && high > 100);
  assert.ok(
    histogram([100, 100], low, high).every((b) => Number.isFinite(b.low)),
  );
});
