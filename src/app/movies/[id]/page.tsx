"use client";

import { useParams, useSearchParams } from "next/navigation";

export default function Detail() {
  const params = useSearchParams();
  const router = useParams();
  return (
    <div>
      <h1>detail</h1>
      <p>{params}</p>
    </div>
  );
}
