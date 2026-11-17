export const ERROR_STATUSES = [400, 401, 403, 404, 405, 408, 409, 410, 413, 415, 422, 423, 429, 500, 501, 502, 503, 504, 507, 508, 511] as const
export type ErrorStatus = typeof ERROR_STATUSES[number]
export function resolveStatusKey(status: number): ErrorStatus {
  return ERROR_STATUSES.includes(status as ErrorStatus) ? status as ErrorStatus : status >= 400 && status < 500 ? 400 : 500
}
export const ERROR_VISUALS: Record<ErrorStatus, string> = {
  400: 'invalid-request', 401: 'expired-session', 403: 'access-shield', 404: 'missing-page', 405: 'method-signpost', 408: 'request-hourglass', 409: 'conflicting-changes', 410: 'removed-archive', 413: 'oversized-file', 415: 'unsupported-file', 422: 'validation-checklist', 423: 'locked-resource', 429: 'traffic-queue', 500: 'server-fault', 501: 'feature-construction', 502: 'broken-gateway', 503: 'server-maintenance', 504: 'gateway-clock', 507: 'storage-full', 508: 'routing-loop', 511: 'network-sign-in',
}
