import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useSession } from "./useSession";

export type IntegrationSettings = {
  slackWebhookUrl: string;
  discordWebhookUrl: string;
  teamsWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  stripePortalUrl?: string;
  autoIncidentEnabled?: boolean;
  autoIncidentErrorThreshold?: number | null;
  autoIncidentWindowSeconds?: number | null;
  autoIncidentCooldownSeconds?: number | null;
};

type SettingsResponse = {
  error: boolean;
  data: IntegrationSettings;
};

type UpdatePayload = {
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  teamsWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  autoIncidentEnabled?: boolean;
  autoIncidentErrorThreshold?: number | null;
  autoIncidentWindowSeconds?: number | null;
  autoIncidentCooldownSeconds?: number | null;
};

export function useIntegrationSettings(enabled: boolean) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["integration-settings", session?.orgId],
    queryFn: fetchIntegrationSettings,
    enabled
  });
}

export function useUpdateIntegrationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePayload) => {
      const response = await apiClient.put<SettingsResponse>("/integrations/settings", payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
    }
  });
}

async function fetchIntegrationSettings(): Promise<IntegrationSettings> {
  const response = await apiClient.get<SettingsResponse>("/integrations/settings");
  return response.data.data;
}
