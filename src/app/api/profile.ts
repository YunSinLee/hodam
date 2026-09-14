import profileClient from "@/lib/client/api/profile";

export * from "@/lib/client/api/profile";

const profileApi = {
  ...profileClient,
  async getUserProfile(userId: string) {
    const { profile } = await profileClient.getProfileSummary();
    if (!userId || !profile || profile.id !== userId) {
      throw new Error("로그인 정보를 확인해주세요.");
    }
    return profile;
  },
  async updateDisplayName(userId: string, displayName: string) {
    const name = displayName.trim();
    if (!name || name.length > 30) {
      throw new Error("이름은 1~30자로 입력해주세요.");
    }
    if (!(await profileClient.updateDisplayName(userId, name))) {
      throw new Error("이름을 저장하지 못했어요. 다시 시도해주세요.");
    }
  },
  async uploadProfileImage(userId: string, file: File) {
    const imageUrl = await profileClient.uploadProfileImage(userId, file);
    if (!imageUrl) {
      throw new Error("사진을 올리지 못했어요. 다시 시도해주세요.");
    }
    return imageUrl;
  },
  async removeCustomProfileImage(userId: string) {
    if (!(await profileClient.removeCustomProfileImage(userId))) {
      throw new Error("프로필 사진을 변경하지 못했어요. 다시 시도해주세요.");
    }
  },
};

export default profileApi;
