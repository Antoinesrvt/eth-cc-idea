"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import type { UserProfile, TeamMember } from "@/lib/types";

interface ProfileWithContracts extends UserProfile {
  contractsAsClient?: unknown[];
  contractsAsAgency?: unknown[];
}

export function useProfile() {
  const { walletAddress, authenticated, getAuthToken } = useAuth();
  const [profile, setProfile] = useState<ProfileWithContracts | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (walletAddress) headers["X-Wallet-Address"] = walletAddress;

      const res = await fetch(`/api/users/${walletAddress}`, { headers });
      if (res.ok) {
        const profileData = await res.json();
        setProfile(profileData);

        // After loading profile, also fetch team if user is an agency
        if (profileData?.roles?.includes("agency")) {
          try {
            const teamRes = await fetch(`/api/agency/team`, { headers });
            if (teamRes.ok) {
              const teamData = await teamRes.json();
              setTeam(teamData.members ?? []);
            }
          } catch {
            // team fetch failed — non-blocking
          }
        }
      }
    } catch {
      // profile may not exist yet
    }
    setLoading(false);
  }, [walletAddress, getAuthToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = async (data: {
    name?: string;
    email?: string;
  }): Promise<ProfileWithContracts> => {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (walletAddress) headers["X-Wallet-Address"] = walletAddress;

    const res = await fetch(`/api/users/${walletAddress}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setProfile(updated);
      return updated;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update profile");
  };

  const updateAgencyProfile = async (data: {
    companyName: string;
    description?: string;
    website?: string;
    categories: string[];
  }): Promise<void> => {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (walletAddress) headers["X-Wallet-Address"] = walletAddress;

    const res = await fetch("/api/agency/setup", {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save agency profile");
    }
  };

  const inviteTeamMember = async (data: {
    email: string;
    name?: string;
    role: "admin" | "member";
  }): Promise<void> => {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (walletAddress) headers["X-Wallet-Address"] = walletAddress;

    const res = await fetch("/api/agency/team", {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to invite team member");
    }
  };

  const uploadDocument = async (
    file: File,
    label: string,
  ): Promise<{ label: string; verified: boolean; hash: string }> => {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", label);

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (walletAddress) headers["X-Wallet-Address"] = walletAddress;

    const res = await fetch(`/api/users/${walletAddress}/documents`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (res.ok) {
      const result = await res.json();
      await refresh();
      return result;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload document");
  };

  return {
    profile,
    team,
    loading,
    refresh,
    updateProfile,
    updateAgencyProfile,
    inviteTeamMember,
    uploadDocument,
    walletAddress,
    authenticated,
  };
}
