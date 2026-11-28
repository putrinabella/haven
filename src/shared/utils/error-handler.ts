import { showAlert } from "@/shared/components/Swal";

/** Turns any thrown value into a message that is safe to show to a user. */
export function getErrorMessage(error: unknown, fallback = "Terjadi kesalahan. Silakan coba lagi."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** Client-side handler: logs in dev only, shows a user-facing alert. */
export function handleApiError(error: unknown, fallback?: string): void {
  if (process.env.NODE_ENV !== "production") console.error(error);
  void showAlert({
    title: "Error",
    text: getErrorMessage(error, fallback),
    icon: "error",
    showConfirmButton: true,
  });
}
