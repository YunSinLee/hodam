export interface NavBarControllerState {
  pathname: string | null;
  hasHydrated: boolean;
  userId: string | undefined;
  userEmail: string | undefined;
  beadCount: number | null | undefined;
  isShowMenu: boolean;
  isScrolled: boolean;
}

export interface NavBarControllerHandlers {
  onSignOut: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}
