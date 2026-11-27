"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { showAlert } from "@/shared/components/Swal";

export function useLogout() {
  const router = useRouter();

  const logout = async () => {
    const confirmed = await showAlert({
      title: "Confirm Logout",
      text: "Are you sure you want to sign out of your account?",
      icon: "warning",
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: "Sign Out",
      cancelButtonText: "Cancel",
    });
    if (!confirmed) return;

    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return { logout };
}
