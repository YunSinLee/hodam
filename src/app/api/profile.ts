import { supabase } from "../utils/supabase";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  profileUrl: string;
  custom_profile_url?: string;
  created_at: string;
}

async function ownUser(userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId)
    throw new Error("로그인 정보를 확인해주세요.");
  return data.user;
}

const profileApi = {
  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await ownUser(userId);
    const { data, error } = await supabase
      .from("users")
      .select("display_name, custom_profile_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const name =
      user.user_metadata?.full_name || user.user_metadata?.name || "사용자";
    if (!data) {
      const { error: insertError } = await supabase
        .from("users")
        .upsert(
          { id: userId, display_name: name, email: user.email },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (insertError) throw insertError;
    }
    let profileUrl =
      data?.custom_profile_url || user.user_metadata?.avatar_url || "";
    if (profileUrl.startsWith("profiles:")) {
      const { data: image } = await supabase.storage
        .from("profiles")
        .createSignedUrl(profileUrl.slice("profiles:".length), 3600);
      profileUrl = image?.signedUrl || "";
    }
    return {
      id: userId,
      email: user.email || "",
      display_name: data?.display_name || name,
      profileUrl,
      custom_profile_url: data?.custom_profile_url,
      created_at: user.created_at,
    };
  },
  async updateDisplayName(userId: string, displayName: string) {
    await ownUser(userId);
    const name = displayName.trim();
    if (!name || name.length > 30)
      throw new Error("이름은 1~30자로 입력해주세요.");
    const { error } = await supabase
      .from("users")
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id")
      .single();
    if (error) throw error;
  },
  async uploadProfileImage(userId: string, file: File) {
    await ownUser(userId);
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = extensions[file.type];
    if (!extension || file.size === 0 || file.size > 5 * 1024 * 1024)
      throw new Error("5MB 이하의 JPG, PNG, WebP, GIF를 골라주세요.");
    const path = `profile_${userId}_${crypto.randomUUID()}.${extension}`;
    const bucket = supabase.storage.from("profiles");
    const { error } = await bucket.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error("Profile upload failed", error);
      throw new Error(
        error.message.toLowerCase().includes("bucket not found")
          ? "사진 저장 기능을 준비 중이에요. 잠시 후 다시 이용해주세요."
          : "사진을 올리지 못했어요. 연결을 확인하고 다시 시도해주세요.",
      );
    }
    const storedPath = `profiles:${path}`;
    const { error: saveError } = await supabase
      .from("users")
      .update({
        custom_profile_url: storedPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id")
      .single();
    if (saveError) {
      console.error("Profile image update failed", saveError);
      throw new Error(
        "사진 변경 결과를 확인하지 못했어요. 계정 정보를 다시 불러와 확인해주세요.",
      );
    }
    return storedPath;
  },
  async removeCustomProfileImage(userId: string) {
    await ownUser(userId);
    const { error } = await supabase
      .from("users")
      .update({
        custom_profile_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id")
      .single();
    if (error) throw error;
  },
};
export default profileApi;
