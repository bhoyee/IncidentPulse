import axios from "axios";

const apiBase = process.env.NEXT_PUBLIC_API_BASE;

if (!apiBase) {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_API_BASE is not set. API calls will fail.");
}

export const apiClient = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  timeout: 1000 * 15
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      return Promise.reject(
        new Error(error.response.data?.message ?? "The request failed. Please try again.")
      );
    }
    if (error.request) {
      return Promise.reject(new Error("No response from server. Check your connection."));
    }
    return Promise.reject(error);
  }
);
