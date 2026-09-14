/* eslint-disable @next/next/no-img-element */
// Native images support signed private URLs or local SVG illustrations.

"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import profileApi, { UserProfile } from "@/app/api/profile";
import userApi from "@/app/api/user";
import GuideForSign from "@/app/components/GuideForSign";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

export default function ProfilePage() {
  const { userInfo } = useUserInfo();
  const { bead } = useBead();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [retry, setRetry] = useState(0);
  const operation = useRef(0);
  const saving = useRef(false);
  useEffect(() => {
    operation.current += 1;
    saving.current = false;
    setBusy(false);
    setNotice("");
    return () => {
      operation.current += 1;
    };
  }, [userInfo.id]);
  useEffect(() => {
    if (!userInfo.id) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setProfile(null);
    profileApi
      .getUserProfile(userInfo.id)
      .then(value => {
        if (active) {
          setProfile(value);
          setName(value.display_name);
        }
      })
      .catch(() => {
        if (active)
          setError("계정 정보를 불러오지 못했어요. 다시 시도해주세요.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userInfo.id, retry]);

  async function update(action: () => Promise<unknown>, message: string) {
    if (saving.current || !userInfo.id) return;
    const owner = userInfo.id;
    const current = ++operation.current;
    const isCurrent = () =>
      current === operation.current &&
      useUserInfo.getState().userInfo.id === owner;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (!isCurrent()) return;
      setRetry(value => value + 1);
      setNotice(message);
    } catch (cause) {
      if (!isCurrent()) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "변경사항을 저장하지 못했어요.",
      );
    } finally {
      if (isCurrent()) {
        saving.current = false;
        setBusy(false);
      }
    }
  }
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await userApi.signOut();
      router.replace("/");
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해주세요.");
      setBusy(false);
    }
  }
  if (!userInfo.id) return <GuideForSign />;
  return (
    <div className="page-shell max-w-3xl">
      <div className="page-heading">
        <p className="eyebrow">나의 호담</p>
        <h1>내 계정</h1>
        <p>함께 읽는 사람의 이름과 계정 정보를 관리해요.</p>
      </div>
      {error && (
        <div role="alert" className="notice-error mb-5">
          {error}
          <button
            type="button"
            className="text-link block mt-3"
            onClick={() => setRetry(value => value + 1)}
          >
            다시 불러오기
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="notice-info mb-5">
          {notice}
        </p>
      )}
      {loading && (
        <p role="status" className="empty-state">
          계정 정보를 불러오고 있어요.
        </p>
      )}
      {profile?.id === userInfo.id && (
        <section className="account-panel">
          <div className="flex items-center gap-5 flex-wrap">
            {profile.profileUrl ? (
              <img
                className="account-avatar"
                src={profile.profileUrl}
                alt="내 프로필 사진"
              />
            ) : (
              <span className="account-avatar" aria-hidden="true">
                {profile.display_name.slice(0, 1)}
              </span>
            )}
            <div>
              <label
                className="text-link cursor-pointer"
                htmlFor="profile-photo"
              >
                사진 바꾸기
              </label>
              <input
                className="block mt-2 text-sm max-w-full"
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={busy}
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file)
                    update(
                      () => profileApi.uploadProfileImage(userInfo.id!, file),
                      "프로필 사진을 바꿨어요.",
                    );
                  const fileInput = event.target;
                  fileInput.value = "";
                }}
              />
              <p className="text-xs text-gray-500 mt-2">
                JPG · PNG · WebP · GIF, 최대 5MB
              </p>
              {profile.custom_profile_url && (
                <button
                  type="button"
                  className="text-link mt-2"
                  disabled={busy}
                  onClick={() =>
                    update(
                      () => profileApi.removeCustomProfileImage(userInfo.id!),
                      "기본 프로필 사진으로 바꿨어요.",
                    )
                  }
                >
                  기본 사진으로 되돌리기
                </button>
              )}
            </div>
          </div>
          <form
            className="mt-8"
            onSubmit={event => {
              event.preventDefault();
              update(
                () => profileApi.updateDisplayName(userInfo.id!, name),
                "이름을 저장했어요.",
              );
            }}
          >
            <label className="block mb-2" htmlFor="profile-name">
              이름
            </label>
            <div className="flex gap-3">
              <input
                className="account-input min-w-0 flex-1"
                id="profile-name"
                value={name}
                onChange={event => setName(event.target.value)}
                required
                maxLength={30}
                autoComplete="nickname"
              />
              <button
                type="submit"
                className="button-secondary"
                disabled={
                  busy || !name.trim() || name.trim() === profile.display_name
                }
              >
                {busy ? "저장 중" : "저장"}
              </button>
            </div>
          </form>
          <dl className="account-details">
            <div>
              <dt>이메일</dt>
              <dd>{profile.email || "이메일 정보 없음"}</dd>
            </div>
            <div>
              <dt>가입일</dt>
              <dd>
                {new Date(profile.created_at).toLocaleDateString("ko-KR")}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <div className="account-links">
        <Link href="/my-story">
          <span>내 책장</span>
          <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/bead">
          <span>
            보유 곶감{" "}
            <strong>
              {bead.count ?? "확인 중"}
              {bead.count !== undefined && "개"}
            </strong>
          </span>
          <span>충전하기 ↗</span>
        </Link>
        <Link href="/payment-history">
          <span>결제 내역</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="text-link mt-8"
      >
        로그아웃
      </button>
    </div>
  );
}
