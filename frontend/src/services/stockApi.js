const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function request(path, signal, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, { ...options, signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Cannot reach the market-data API. Check that the backend is running.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : "Market data is temporarily unavailable. Please retry.",
    );
  if (body === null)
    throw new Error("The API returned an unreadable response.");
  return body;
}
export const searchStocks = (query, signal) =>
  request(`/search?q=${encodeURIComponent(query)}`, signal);
export const getHistory = (ticker, period, signal) =>
  request(
    `/stocks/${encodeURIComponent(ticker)}/history?period=${period}`,
    signal,
  );

export const runSimulation = (parameters, signal) =>
  request("/simulations/monte-carlo", signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parameters),
  });
