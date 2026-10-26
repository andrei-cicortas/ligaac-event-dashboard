// Structured (one JSON object per line) logging to stdout, so it plugs into
// whatever log driver/aggregator picks up container output without extra deps.
export function logEvent(action, details = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), action, ...details }));
}
