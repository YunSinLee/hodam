"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { PicturebookDraft } from "@/app/types/openai";

import styles from "./PicturebookPdfButton.module.css";

interface PicturebookPdfButtonProps {
  picturebook: PicturebookDraft;
  imageUrls: Record<number, string | null | undefined>;
  imageUrl?: string | null;
  isImageLoading?: boolean;
}

export default function PicturebookPdfButton({
  picturebook,
  imageUrls,
  imageUrl,
  isImageLoading = false,
}: PicturebookPdfButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showTextOption, setShowTextOption] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const statusId = useId();
  const identity = `${picturebook.createdAt}:${picturebook.title}:${picturebook.childName}:${picturebook.selectedChoiceId}`;
  useEffect(() => {
    setIsSaving(false);
    setMessage("");
    setShowTextOption(false);
    return () => controllerRef.current?.abort();
  }, [identity]);

  const savePdf = async (illustrated: boolean) => {
    if (controllerRef.current && !controllerRef.current.signal.aborted) return;
    const missing = picturebook.pages.filter(
      page =>
        !(imageUrls[page.pageNumber] || (page.pageNumber === 1 && imageUrl)),
    );
    if (illustrated && (isImageLoading || missing.length)) {
      setShowTextOption(true);
      setMessage(
        isImageLoading
          ? "그림을 준비하고 있어요. 완성된 뒤 그림과 함께 저장하거나, 지금 글만 저장할 수 있어요."
          : `${missing.map(page => page.pageNumber).join(", ")}쪽 그림이 아직 없어요. 그림이 준비된 뒤 다시 시도하거나 글만 저장할 수 있어요.`,
      );
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSaving(true);
    setShowTextOption(false);
    setMessage(
      illustrated
        ? "그림과 글을 PDF에 담고 있어요."
        : "글을 PDF에 담고 있어요.",
    );
    try {
      const { downloadPicturebookPdf } = await import("@/lib/picturebook/pdf");
      controller.signal.throwIfAborted();
      await downloadPicturebookPdf({
        picturebook,
        imageUrls,
        imageUrl,
        illustrated,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setMessage(
          "PDF를 준비했어요. 브라우저의 다운로드 목록을 확인해 주세요.",
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const code =
          error && typeof error === "object" && "code" in error
            ? error.code
            : undefined;
        setShowTextOption(code === "images");
        setMessage(
          code && error instanceof Error
            ? error.message
            : "PDF를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSaving(false);
        controller.abort();
      }
    }
  };

  return (
    <div className={styles.export}>
      <button
        type="button"
        className="button-primary"
        onClick={() => {
          savePdf(true);
        }}
        disabled={isSaving || picturebook.status !== "complete"}
        aria-describedby={message ? statusId : undefined}
        aria-busy={isSaving}
      >
        {isSaving ? "PDF 준비 중…" : "PDF 저장"}
      </button>
      {message && (
        <div
          id={statusId}
          className={styles.status}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}
      {showTextOption && (
        <button
          type="button"
          className={styles.textOption}
          disabled={isSaving}
          onClick={() => {
            savePdf(false);
          }}
        >
          그림 없이 글만 PDF로 저장
        </button>
      )}
    </div>
  );
}
