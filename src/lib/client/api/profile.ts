import {
  ProfileImageUploadResponseSchema,
  ProfileSummaryResponseSchema,
  SuccessResponseSchema,
} from "@/app/api/v1/schemas";
import type {
  PaymentHistoryItem as ApiPaymentHistory,
  ProfileSummaryResponse,
  RecentStory as ApiRecentStory,
  UserProfile as ApiUserProfile,
  UserStats as ApiUserStats,
} from "@/app/api/v1/types";

import { ApiError, authorizedFetch } from "./http";

export type UserProfile = ApiUserProfile;
export type UserStats = ApiUserStats;
export type RecentStory = ApiRecentStory;
export type PaymentHistory = Pick<
  ApiPaymentHistory,
  "id" | "bead_quantity" | "amount" | "created_at" | "status"
>;
export type ProfileSummary = ProfileSummaryResponse;

const profileApi = {
  async getProfileSummary(limit: number = 5): Promise<ProfileSummary> {
    return authorizedFetch<ProfileSummaryResponse>(
      `/api/v1/profile/summary?limit=${limit}`,
      {
        method: "GET",
      },
      ProfileSummaryResponseSchema,
    );
  },

  async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<boolean> {
    if (!userId) {
      return false;
    }

    await authorizedFetch<{ success: boolean }>(
      "/api/v1/profile/display-name",
      {
        method: "POST",
        body: JSON.stringify({ displayName }),
      },
      SuccessResponseSchema,
    );

    return true;
  },

  async uploadProfileImage(
    userId: string,
    imageFile: File,
  ): Promise<string | null> {
    try {
      if (!userId) {
        return null;
      }

      const formData = new FormData();
      formData.append("file", imageFile);

      const response = await authorizedFetch<{
        success: boolean;
        imageUrl?: string;
      }>(
        "/api/v1/profile/image",
        {
          method: "POST",
          body: formData,
        },
        ProfileImageUploadResponseSchema,
      );

      return response.imageUrl || null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        throw new Error(error.message);
      }
      return null;
    }
  },

  async removeCustomProfileImage(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const response = await authorizedFetch<{ success: boolean }>(
      "/api/v1/profile/image",
      {
        method: "DELETE",
      },
      SuccessResponseSchema,
    );

    return response.success;
  },
};

export default profileApi;
