import { apiClient } from "./api-client";
import type { IncidentAttachment } from "./types";

export const MAX_ATTACHMENTS_PER_BATCH = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export function buildAttachmentUrl(relativeUrl: string): string {
  if (!relativeUrl) {
    return "#";
  }
  if (/^https?:\/\//i.test(relativeUrl)) {
    return relativeUrl;
  }
  if (!API_BASE) {
    return relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;
  }
  const normalized = relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;
  return `${API_BASE}${normalized}`;
}

export function formatAttachmentSize(bytes: number): string {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const decimals = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export function validateAttachmentSize(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `File "${file.name}" exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB limit.`;
  }
  if (file.size === 0) {
    return `File "${file.name}" appears empty.`;
  }
  return null;
}

export async function uploadIncidentAttachment(
  incidentId: string,
  file: File
): Promise<IncidentAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<{ error: boolean; data: IncidentAttachment }>(
    `/incidents/${incidentId}/attachments`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" }
    }
  );
  return response.data.data;
}

export async function deleteIncidentAttachment(incidentId: string, attachmentId: string): Promise<void> {
  await apiClient.delete(`/incidents/${incidentId}/attachments/${attachmentId}`);
}
