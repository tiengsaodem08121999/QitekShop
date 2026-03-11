import { apiFetch } from "./api";
import type { User } from "@/types";

export async function login(username: string, password: string): Promise<string> {
  const res = await apiFetch<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("token", res.access_token);
  return res.access_token;
}

export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/api/auth/me");
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("token");
}
