import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";

export type IntegrationSettings = {
  slackWebhookUrl: string;
  discordWebhookUrl: string;
  teamsWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
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
};

export function useIntegrationSettings(enabled: boolean) {
  return useQuery({
    queryKey: ["integration-settings"],
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
