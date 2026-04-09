export interface SignInProviderAvailabilityState {
  kakao: boolean;
  google: boolean;
}

export interface SignInProviderWarningState {
  kakao: string | null;
  google: string | null;
}

export interface SignInPageState {
  providerAvailability: SignInProviderAvailabilityState;
  providerWarnings: SignInProviderWarningState;
  isKakaoLoading: boolean;
  isGoogleLoading: boolean;
  isAnyLoading: boolean;
  errorMessage: string | null;
  authConfigWarning: string | null;
  authProviderWarning: string | null;
  resolvedRedirectUrl: string | null;
  recoveryHint: string | null;
}

export interface SignInPageHandlers {
  signInWithProvider: (provider: "kakao" | "google") => Promise<void>;
}
