-- Migration: webhook_delivery_logs
-- The outbound-webhook delivery system in src/lib/services/webhook-delivery.ts
-- (and the WebhookDeliveryLog Prisma model) read/write this table for
-- delivery tracking, retries, and audit. The Prisma model has existed for
-- months but no SQL migration ever created the table — meaning every
-- delivery attempt silently failed at the persistence step and no retry
-- chain ever ran. Critical for the bridge / events / alert-rule webhook path.
--
-- Shape mirrors prisma/schema.prisma model WebhookDeliveryLog exactly.

CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_event_id  uuid NOT NULL,
  alert_rule_id   uuid NOT NULL,
  url             text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  http_status     integer,
  attempts        integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_retry_at   timestamptz,
  response_body   text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_alert_event ON public.webhook_delivery_logs(alert_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_alert_rule  ON public.webhook_delivery_logs(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_status      ON public.webhook_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_next_retry  ON public.webhook_delivery_logs(next_retry_at);

-- Internal infrastructure table: only the service-role server client writes
-- it. RLS enabled with no policy => denied for anon/authenticated; service
-- role bypasses RLS. Same posture as serpapi_usage / keyword_tracking.
ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
