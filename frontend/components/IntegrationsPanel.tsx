"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { IntegrationSettings } from "@hooks/useIntegrationSettings";

type Props = {
  settings?: IntegrationSettings;
  isLoading: boolean;
  onSave: (payload: Partial<IntegrationSettings>) => Promise<void>;
  isSaving: boolean;
};

const defaultState: IntegrationSettings = {
  slackWebhookUrl: "",
  discordWebhookUrl: "",
  teamsWebhookUrl: "",
  telegramBotToken: "",
  telegramChatId: "",
  autoIncidentEnabled: false,
  autoIncidentErrorThreshold: null,
  autoIncidentWindowSeconds: null,
  autoIncidentCooldownSeconds: null,
  autoIncidentAiEnabled: false,
  autoIncidentSummaryLines: null
};

const githubWorkflowSample = `jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Notify IncidentPulse when CI fails
        if: failure()
        env:
          WEBHOOK_URL: \${{ secrets.INCIDENTPULSE_ALERT_URL }}
          WEBHOOK_SECRET: \${{ secrets.INCIDENTPULSE_HMAC }}
        run: |
          payload=$(cat <<'JSON'
          {
            "service": "ci-pipeline",
            "environment": "\${{ github.ref_name }}",
            "eventType": "workflow_failure",
            "message": "Workflow \${{ github.workflow }} failed on \${{ github.ref }}",
            "severity": "high",
            "occurredAt": "\${{ github.event.head_commit.timestamp }}",
            "fingerprint": "ci|\${{ github.repository }}|\${{ github.workflow }}"
          }
JSON
          )
          signature=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')
          curl -sSf -X POST "$WEBHOOK_URL" \\
            -H "Content-Type: application/json" \\
            -H "X-Signature: $signature" \\
            --data "$payload"`;

const uptimeRobotSample = `POST /webhooks/incidents
Content-Type: application/json
X-Signature: <hex-hmac-from-WEBHOOK_HMAC_SECRET>

{
  "service": "edge-api",
  "environment": "production",
  "eventType": "uptimerobot_downtime",
  "severity": "high",
  "message": "UptimeRobot monitor {{MONITOR_NAME}} reported status {{ALERT_TYPE}}",
  "fingerprint": "uptimerobot|{{MONITOR_ID}}",
  "occurredAt": "{{EVENT_TIME_ISO}}",
  "meta": {
    "monitorUrl": "{{URL}}",
    "alertType": "{{ALERT_TYPE}}"
  }
}`;

export function IntegrationsPanel({ settings, isLoading, onSave, isSaving }: Props) {
  const [form, setForm] = useState<IntegrationSettings>(defaultState);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = isLoading || isSaving;

  useEffect(() => {
    if (settings) {
      setForm(settings);
    } else if (!isLoading) {
      setForm(defaultState);
    }
  }, [settings, isLoading]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    try {
      await onSave({
        ...form,
        autoIncidentErrorThreshold: form.autoIncidentErrorThreshold
          ? Number(form.autoIncidentErrorThreshold)
          : null,
        autoIncidentWindowSeconds: form.autoIncidentWindowSeconds
          ? Number(form.autoIncidentWindowSeconds)
          : null,
        autoIncidentCooldownSeconds: form.autoIncidentCooldownSeconds
          ? Number(form.autoIncidentCooldownSeconds)
          : null
      });
      setMessage("Integration settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Integrations & Notifications</h2>
        <p className="text-sm text-gray-600">
          Connect Slack, Discord, Teams, or Telegram for outbound alerts, then wire GitHub Actions or
          UptimeRobot into the webhook endpoint for automated incident creation. Full walkthroughs
          live in the{" "}
          <Link href="/docs#webhooks" className="text-blue-600 underline">
            webhook reference
          </Link>
          .
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900 space-y-3">
        <p>
          Generate the HMAC secret once (for example{" "}
          <code className="font-mono text-xs text-blue-700">openssl rand -hex 32</code>), store
          it in Render &rarr; Environment, and share it with monitoring tools via your secrets
          manager. The dashboard never exposes secret values to reduce leakage risk.
        </p>
        <p>
          Keep <code className="font-mono text-xs text-blue-700">WEBHOOK_SHARED_TOKEN</code> and
          <code className="ml-1 font-mono text-xs text-blue-700">WEBHOOK_SYSTEM_USER_ID</code>
          handy for trusted internal scripts. Webhook activity metrics are available via{" "}
          <code className="font-mono text-xs text-blue-700">GET /metrics/webhook</code>.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800">GitHub Actions template</h3>
          <p className="mt-1 text-xs text-gray-600">
            Add a final job step to any workflow. Store the alert URL + HMAC secret as encrypted
            repository secrets and reuse this snippet.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-gray-900 p-3 text-[11px] leading-snug text-gray-100">
            <code>{githubWorkflowSample}</code>
          </pre>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800">UptimeRobot alert contact</h3>
          <p className="mt-1 text-xs text-gray-600">
            Create a custom webhook contact and paste the alert URL. Map monitor placeholders to the
            payload below so repeated downtime dedupes automatically.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-gray-900 p-3 text-[11px] leading-snug text-gray-100">
            <code>{uptimeRobotSample}</code>
          </pre>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-500">Loading integration settings…</p>
      ) : null}

      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
        <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
          <legend className="text-sm font-semibold text-gray-800">Slack Incoming Webhook</legend>
          <label className="block text-sm font-medium text-gray-700">
            Webhook URL
            <input
              type="url"
              name="slackWebhookUrl"
              value={form.slackWebhookUrl}
              onChange={handleChange}
              placeholder="https://hooks.slack.com/services/..."
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              disabled={disabled}
            />
          </label>
          <p className="text-xs text-gray-600">
            Create a Slack App &rarr; Incoming Webhook, paste the URL here, and we will post incident
            lifecycle events to that channel.
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
          <legend className="text-sm font-semibold text-gray-800">Discord Webhook</legend>
          <label className="block text-sm font-medium text-gray-700">
            Webhook URL
            <input
              type="url"
              name="discordWebhookUrl"
              value={form.discordWebhookUrl}
              onChange={handleChange}
              placeholder="https://discord.com/api/webhooks/..."
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              disabled={disabled}
            />
          </label>
          <p className="text-xs text-gray-600">
            Server Settings → Integrations → Webhooks lets you pick a channel and copy the URL.
            Every incident event publishes severity, status, and a direct dashboard link.
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
          <legend className="text-sm font-semibold text-gray-800">Microsoft Teams</legend>
          <label className="block text-sm font-medium text-gray-700">
            Incoming webhook URL
            <input
              type="url"
              name="teamsWebhookUrl"
              value={form.teamsWebhookUrl}
              onChange={handleChange}
              placeholder="https://outlook.office.com/webhook/..."
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500 text-sm"
              disabled={disabled}
            />
          </label>
          <p className="text-xs text-gray-600">
            Add an Incoming Webhook connector to any channel, copy its URL, and IncidentPulse will
            send MessageCards with color accents tied to severity.
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
          <legend className="text-sm font-semibold text-gray-800">Telegram Bot</legend>
          <label className="block text-sm font-medium text-gray-700">
            Bot Token
            <input
              type="text"
              name="telegramBotToken"
              value={form.telegramBotToken}
              onChange={handleChange}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              disabled={disabled}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Chat ID
            <input
              type="text"
              name="telegramChatId"
              value={form.telegramChatId}
              onChange={handleChange}
              placeholder="@incidentpulse-alerts or numeric chat id"
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              disabled={disabled}
            />
          </label>
          <p className="text-xs text-gray-600">
            Use <code className="font-mono text-xs text-gray-600">BotFather</code> to create a bot,
            then message it to retrieve the chat ID (via <code className="font-mono text-xs text-gray-600">/getUpdates</code>).
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <legend className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <span>Log-based auto incidents</span>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
              Beta
            </span>
          </legend>
          <label className="flex items-center gap-3 text-sm font-medium text-amber-900">
            <input
              type="checkbox"
              name="autoIncidentEnabled"
              checked={Boolean(form.autoIncidentEnabled)}
              onChange={(e) => setForm((prev) => ({ ...prev, autoIncidentEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              disabled={disabled}
            />
            Enable auto-created incidents from log ingest (per org)
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-amber-900">
              Error threshold
              <input
                type="number"
                min={1}
                name="autoIncidentErrorThreshold"
                value={form.autoIncidentErrorThreshold ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    autoIncidentErrorThreshold: e.target.value ? Number(e.target.value) : null
                  }))
                }
                placeholder="20"
                className="mt-1 w-full rounded-md border-amber-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                disabled={disabled}
              />
              <span className="mt-1 block text-xs text-amber-800">Errors in the window before triggering.</span>
            </label>
            <label className="text-sm text-amber-900">
              Window (seconds)
              <input
                type="number"
                min={10}
                name="autoIncidentWindowSeconds"
                value={form.autoIncidentWindowSeconds ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    autoIncidentWindowSeconds: e.target.value ? Number(e.target.value) : null
                  }))
                }
                placeholder="60"
                className="mt-1 w-full rounded-md border-amber-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                disabled={disabled}
              />
              <span className="mt-1 block text-xs text-amber-800">Lookback window for counting errors.</span>
            </label>
            <label className="text-sm text-amber-900">
              Cooldown (seconds)
              <input
                type="number"
                min={30}
                name="autoIncidentCooldownSeconds"
                value={form.autoIncidentCooldownSeconds ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    autoIncidentCooldownSeconds: e.target.value ? Number(e.target.value) : null
                  }))
                }
                placeholder="300"
                className="mt-1 w-full rounded-md border-amber-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                disabled={disabled}
              />
              <span className="mt-1 block text-xs text-amber-800">Wait before triggering again.</span>
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-amber-900">
            <input
              type="checkbox"
              name="autoIncidentAiEnabled"
              checked={Boolean(form.autoIncidentAiEnabled)}
              onChange={(e) => setForm((prev) => ({ ...prev, autoIncidentAiEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              disabled={disabled}
            />
            Attach AI log summary when auto-incident is created
          </label>
          <label className="text-sm text-amber-900">
            Lines to summarize (optional)
            <input
              type="number"
              min={10}
              max={200}
              name="autoIncidentSummaryLines"
              value={form.autoIncidentSummaryLines ?? ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  autoIncidentSummaryLines: e.target.value ? Number(e.target.value) : null
                }))
              }
              placeholder="200"
              className="mt-1 w-full rounded-md border-amber-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
              disabled={disabled}
            />
            <span className="mt-1 block text-xs text-amber-800">
              We cap size internally; fewer lines reduces token usage.
            </span>
          </label>
          <p className="text-xs text-amber-800">
            We only ingest events for services defined in this org. Use the org API key to post logs to
            <code className="font-mono text-xs text-amber-900 ml-1">/logs/ingest</code> with <code className="font-mono text-xs text-amber-900">service</code>, <code className="font-mono text-xs text-amber-900">level</code>, and <code className="font-mono text-xs text-amber-900">message</code>.
            If an AI provider key is not configured on the backend, summaries are simply skipped; keys are never shown in the UI.
          </p>
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-600">
            Need help? Review the{" "}
            <Link href="/docs#webhooks" className="text-blue-600 underline">
              webhook guide
            </Link>{" "}
            for GitHub, UptimeRobot, Discord, Teams, and Telegram walkthroughs.
          </div>
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving…" : "Save settings"}
          </button>
        </div>

        {message ? <p className="text-sm text-green-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </div>
  );
}
