import { supabase } from "../utils/supabase";

export interface UserProfile {
  id: string;
  email: string;
  profileUrl: string;
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

      // 기본 사용자 정보
      const profile: UserProfile = {
        id: user.user.id,
        email: user.user.email || "",
        profileUrl: user.user.user_metadata?.avatar_url || "",
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
};

export default profileApi;
