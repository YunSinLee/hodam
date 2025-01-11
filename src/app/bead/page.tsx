"use client";

import React, { useState } from "react";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";
// import beadApi from "@/app/api/bead";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog"; // Dialog 컴포넌트 추가

export default function BeadPage() {
  const { bead } = useBead();
  const { userInfo } = useUserInfo();
  const [displayDialog, setDisplayDialog] = useState(false); // 다이얼로그 상태 추가

  async function chargeBeads(quantity: number, price: number) {
    if (!userInfo.id || !bead) return;

    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "charge_beads", {
        category: "Bead",
        action: "Charge",
        label: `${quantity} Beads`,
        value: price,
      });
    }

    // 다이얼로그 표시
    await setDisplayDialog(true);

    // TODO: 임시로 충전기능 막기
    // const beadInfo = await beadApi.updateBeadCount(
    //   userInfo.id,
    //   bead.count! + quantity,
    // );

    // setBead(beadInfo);
  }

  const buttonData = [
    { quantity: 5, price: 2500 },
    { quantity: 10, price: 5000 },
    { quantity: 20, price: 10000 },
    { quantity: 100, price: 50000 },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <img src="persimmon_240424.png" alt="Bead" className="w-24 h-24" />
      <p className="text-xl font-bold">Bead Count: {bead.count}</p>
      <div className="flex flex-wrap gap-4 items-center justify-center">
        {buttonData.map(button => (
          <Button
            key={button.quantity}
            onClick={() => chargeBeads(button.quantity, button.price)}
            className="p-button-outlined min-w-32 flex flex-col items-center justify-center"
          >
            <div className="flex items-center">
              <img
                src="persimmon_240424.png"
                alt={`${button.quantity}`}
                className="w-8 h-8"
              />{" "}
              X {button.quantity}
            </div>
            <div className="text-xl">{button.price}원</div>
          </Button>
        ))}
      </div>

      {/* Dialog 컴포넌트 추가 */}
      <Dialog
        modal
        visible={displayDialog}
        onHide={() => setDisplayDialog(false)}
        footer={
          <div>
            <Button label="확인" onClick={() => setDisplayDialog(false)} />
          </div>
        }
      >
        <p>아직 호담은 결제 기능이 없습니다.</p>
        <p>
          아래 설문에 이메일을 남겨주시면, 정식 출시할 경우 다시
          연락드리겠습니다.
        </p>
        <p>하루 안에 결제 없이 곶감을 충전해드리겠습니다.</p>
        <a
          className="underline text-sky-500"
          href="https://forms.gle/zKVVo9VKtsDyZGXy8"
          target="_blank"
          rel="noopener noreferrer"
        >
          설문링크
        </a>
      </Dialog>
    </div>
  );
}
