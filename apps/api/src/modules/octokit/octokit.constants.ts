export const OCTOKIT_REQUEST_TIMEOUT_MS = 10_000;

export const RATE_LIMIT_LOG_INTERVAL = 50;

// Max retries on rate-limit before surfacing the error. The throttling
// plugin applies exponential back-off between attempts, so 3 retries
// covers transient bursts without stalling a request indefinitely.
export const RATE_LIMIT_MAX_RETRIES = 3;
