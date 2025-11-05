export type WebhookMetrics = {
  totalReceived: number;
  created: number;
  deduped: number;
  recovered: number;
  rejected: number;
  rateLimited: number;
  idempotentReplay: number;
  recoveryMiss: number;
};

const metrics: WebhookMetrics = {
  totalReceived: 0,
  created: 0,
  deduped: 0,
  recovered: 0,
  rejected: 0,
  rateLimited: 0,
  idempotentReplay: 0,
  recoveryMiss: 0
};

export function incrementWebhookMetric(key: keyof WebhookMetrics): void {
  if (Object.prototype.hasOwnProperty.call(metrics, key)) {
    metrics[key] += 1;
  }
}

export function getWebhookMetrics(): WebhookMetrics {
  return { ...metrics };
}
