"use client";

import { useMemo, useSyncExternalStore } from "react";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  createdAt: number;
  lastActive: number;
};

const USER_STORAGE_KEY = "gitprism_user_profile";

const DETERMINISTIC_DEFAULT: UserProfile = {
  id: "usr_developer",
  name: "Developer",
  email: "developer@local",
  avatarColor: "#8B5CF6",
  createdAt: 1700000000000,
  lastActive: 1700000000000,
};

const AVATAR_COLORS = [
  "#8B5CF6", // Violet
  "#06B6D4", // Cyan
  "#EC4899", // Magenta
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
];

function generateClientProfile(suggestedName?: string, suggestedEmail?: string): UserProfile {
  const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  return {
    id,
    name: suggestedName || "Developer",
    email: suggestedEmail || "developer@local",
    avatarColor: color,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
}

export function getStoredUserProfile(): UserProfile {
  if (typeof window === "undefined") {
    return DETERMINISTIC_DEFAULT;
  }
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === "string") {
        return parsed as UserProfile;
      }
    }
  } catch {
    // ignore
  }

  const generated = generateClientProfile();
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(generated));
  } catch {
    // ignore
  }
  return generated;
}

export function saveStoredUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    const updated = { ...profile, lastActive: Date.now() };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("gitprism_auth_change"));
  } catch {
    // ignore
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("gitprism_auth_change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("gitprism_auth_change", callback);
  };
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(USER_STORAGE_KEY) || "";
}

function getServerSnapshot(): string {
  return "";
}

/** React hook for managing active user identity in GitPrism */
export function useUserAuth() {
  const rawJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const user = useMemo<UserProfile>(() => {
    if (!rawJson) {
      return typeof window === "undefined" ? DETERMINISTIC_DEFAULT : getStoredUserProfile();
    }
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed.id === "string") {
        return parsed as UserProfile;
      }
    } catch {
      // ignore
    }
    return getStoredUserProfile();
  }, [rawJson]);

  const updateProfile = (updates: Partial<UserProfile>) => {
    const next = { ...user, ...updates, lastActive: Date.now() };
    saveStoredUserProfile(next);
  };

  const loginWithIdentity = (name: string, email: string) => {
    updateProfile({
      name: name.trim() || "Developer",
      email: email.trim() || "developer@local",
    });
  };

  return {
    user,
    updateProfile,
    loginWithIdentity,
  };
}
