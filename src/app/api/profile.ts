import { supabase } from "../utils/supabase";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  profileUrl: string;
  custom_profile_url?: string;
  created_at: string;
  totalStories: number;
  totalBeadsPurchased: number;
  totalBeadsUsed: number;
}

export interface UserStats {
  totalStories: number;
  totalBeadsPurchased: number;
  totalBeadsUsed: number;
  totalPaymentAmount: number;
  joinDate: string;
}

export interface RecentStory {
  id: number;
  created_at: string;
  able_english: boolean;
  has_image: boolean;
  keywords: { keyword: string }[];
}

export interface PaymentHistory {
  id: string;
  bead_quantity: number;
  amount: number;
  created_at: string;
  status: string;
}

const profileApi = {
  // 사용자 기본 정보 조회
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user.user) {
        throw new Error("사용자 정보를 찾을 수 없습니다.");
      }

      // users 테이블에서 display_name과 custom_profile_url 조회
      const { data: initialUserData, error: userDataError } = await supabase
        .from("users")
        .select("display_name, custom_profile_url")
        .eq("id", userId)
        .single();

      let userData = initialUserData;

      // 사용자가 users 테이블에 없으면 생성
      if (userDataError?.code === "PGRST116") {
        console.log("사용자가 users 테이블에 없음, 새로 생성합니다.");

        const defaultDisplayName =
          user.user.user_metadata?.full_name ||
          user.user.user_metadata?.name ||
          `User_${userId.slice(-8)}`;

        const { data: newUserData, error: insertError } = await supabase
          .from("users")
          .insert({
            id: userId,
            display_name: defaultDisplayName,
            email: user.user.email,
          })
          .select("display_name, custom_profile_url")
          .single();

        if (insertError) {
          console.error("사용자 생성 오류:", insertError);
        } else {
          userData = newUserData;
          console.log("사용자 생성 성공:", userData);
        }
      } else if (userDataError) {
        console.error("사용자 데이터 조회 오류:", userDataError);
      }

      // 기본 사용자 정보
      const profile: UserProfile = {
        id: user.user.id,
        email: user.user.email || "",
        display_name:
          userData?.display_name ||
          user.user.user_metadata?.full_name ||
          user.user.user_metadata?.name ||
          "사용자",
        profileUrl:
          userData?.custom_profile_url ||
          user.user.user_metadata?.avatar_url ||
          "",
        custom_profile_url: userData?.custom_profile_url,
        created_at: user.user.created_at,
        totalStories: 0,
        totalBeadsPurchased: 0,
        totalBeadsUsed: 0,
      };

      return profile;
    } catch (error) {
      console.error("프로필 조회 오류:", error);
      return null;
    }
  },

  // 닉네임 업데이트
  async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<boolean> {
    try {
      console.log("닉네임 업데이트 시도:", { userId, displayName });

      // 먼저 현재 사용자 확인
      const { data: currentUser, error: userError } =
        await supabase.auth.getUser();
      if (userError || !currentUser.user) {
        console.error("사용자 인증 오류:", userError);
        return false;
      }

      console.log("현재 사용자 ID:", currentUser.user.id);
      console.log("업데이트 대상 ID:", userId);

      // 사용자 ID 일치 확인
      if (currentUser.user.id !== userId) {
        console.error("사용자 ID 불일치");
        return false;
      }

      const { data, error } = await supabase
        .from("users")
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select();

      if (error) {
        console.error("닉네임 업데이트 오류:", error);
        return false;
      }

      console.log("닉네임 업데이트 성공:", data);
      return true;
    } catch (error) {
      console.error("닉네임 업데이트 예외:", error);
      return false;
    }
  },

  // 사용자 통계 정보 조회
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      // 생성한 동화 수 조회
      const { data: threads, error: threadsError } = await supabase
        .from("thread")
        .select("id")
        .eq("user_id", userId);

      const totalStories = threads?.length || 0;

      // 결제 내역에서 구매한 곶감 수 조회
      const { data: payments, error: paymentsError } = await supabase
        .from("payment_history")
        .select("bead_quantity, amount")
        .eq("user_id", userId)
        .eq("status", "completed");

      const totalBeadsPurchased =
        payments?.reduce(
          (sum, payment) => sum + (payment.bead_quantity || 0),
          0,
        ) || 0;
      const totalPaymentAmount =
        payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;

      // 사용자가 생성한 메시지 수 조회 (곶감 사용량 계산용)
      let totalBeadsUsed = 0;
      if (threads && threads.length > 0) {
        const { count: messageCount, error: messageError } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in(
            "thread_id",
            threads.map(t => t.id),
          );

        totalBeadsUsed = messageCount || 0;
      }

      // 사용자 가입일
      const { data: user } = await supabase.auth.getUser();
      const joinDate = user.user?.created_at || "";

      return {
        totalStories,
        totalBeadsPurchased,
        totalBeadsUsed,
        totalPaymentAmount,
        joinDate,
      };
    } catch (error) {
      console.error("사용자 통계 조회 오류:", error);
      return {
        totalStories: 0,
        totalBeadsPurchased: 0,
        totalBeadsUsed: 0,
        totalPaymentAmount: 0,
        joinDate: "",
      };
    }
  },

  // 최근 생성한 동화 목록 조회
  async getRecentStories(
    userId: string,
    limit: number = 5,
  ): Promise<RecentStory[]> {
    try {
      // 먼저 thread 정보를 가져옵니다
      const { data: threads, error: threadsError } = await supabase
        .from("thread")
        .select("id, created_at, able_english, has_image")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (threadsError) {
        console.error("최근 동화 조회 오류:", threadsError);
        return [];
      }

      if (!threads || threads.length === 0) {
        return [];
      }

      // 각 thread에 대해 keywords를 가져옵니다
      const threadsWithKeywords = await Promise.all(
        threads.map(async thread => {
          const { data: keywords } = await supabase
            .from("keywords")
            .select("keyword")
            .eq("thread_id", thread.id);

          return {
            ...thread,
            keywords: keywords || [],
          };
        }),
      );

      return threadsWithKeywords as RecentStory[];
    } catch (error) {
      console.error("최근 동화 조회 오류:", error);
      return [];
    }
  },

  // 최근 곶감 사용 내역 조회 (임시로 결제 내역으로 대체)
  async getRecentBeadUsage(userId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from("payment_history")
        .select("id, bead_quantity, amount, created_at, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("곶감 사용 내역 조회 오류:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("곶감 사용 내역 조회 오류:", error);
      return [];
    }
  },

  // 프로필 이미지 업로드
  async uploadProfileImage(
    userId: string,
    imageFile: File,
  ): Promise<string | null> {
    try {
      // 파일 확장자 추출
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `profile_${userId}_${Date.now()}.${fileExt}`;

      // Supabase Storage에 이미지 업로드
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("이미지 업로드 오류:", uploadError);
        return null;
      }

      // 업로드된 이미지의 공개 URL 생성
      const { data: urlData } = supabase.storage
        .from("profiles")
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;

      // users 테이블에 custom_profile_url 업데이트
      const { error: updateError } = await supabase
        .from("users")
        .update({
          custom_profile_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        console.error("프로필 URL 업데이트 오류:", updateError);
        return null;
      }

      return imageUrl;
    } catch (error) {
      console.error("프로필 이미지 업로드 오류:", error);
      return null;
    }
  },

  // 프로필 이미지 삭제 (소셜 로그인 이미지로 되돌리기)
  async removeCustomProfileImage(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("users")
        .update({
          custom_profile_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        console.error("커스텀 프로필 이미지 삭제 오류:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("커스텀 프로필 이미지 삭제 오류:", error);
      return false;
    }
  },
};

export default profileApi;
