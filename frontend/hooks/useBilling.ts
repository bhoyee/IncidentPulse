"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { useQuery } from "@tanstack/react-query";

type PortalResponse = {
  error: boolean;
  data: { url: string };
};

type CheckoutResponse = {
  error: boolean;
  data: { url: string };
};

type Invoice = {
  id: string;
  number: string | null;
  status: string;
  total: number;
  currency: string;
  hostedInvoiceUrl?: string | null;
  createdAt: number;
  invoicePdf?: string | null;
};

type InvoiceResponse = {
  error: boolean;
  data: Invoice[];
};

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get<PortalResponse>("/billing/portal");
      return res.data.data.url;
    }
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async (price: "pro" | "enterprise" = "pro") => {
      const res = await apiClient.get<CheckoutResponse>("/billing/checkout", {
        params: { price }
      });
      return res.data.data.url;
    }
  });
}

export function useInvoices(enabled: boolean) {
  return useQuery({
    queryKey: ["billing", "invoices"],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<InvoiceResponse>("/billing/invoices");
      return res.data.data;
    }
  });
}
