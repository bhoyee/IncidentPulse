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
  telegramBotToken: "",
  telegramChatId: ""
};

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
      await onSave(form);
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
          Configure Slack and Telegram notifications, then follow the{" "}
          <Link href="/docs#webhooks" className="text-blue-600 underline">
            webhook documentation
          </Link>{" "}
          to automate incident intake.
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-600">
            Need help? Review the{" "}
            <Link href="/docs#webhooks" className="text-blue-600 underline">
              webhook guide
            </Link>{" "}
            for Postman scripts and curl examples.
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
