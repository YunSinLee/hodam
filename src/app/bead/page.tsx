"use client";

import React from "react";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";
import beadApi from "@/app/api/bead";
import { Button } from "primereact/button";

const BeadPage: React.FC = () => {
  const { bead, setBead } = useBead();
  const { userInfo } = useUserInfo();

  async function chargeBeads(quantity: number, price: number) {
    if (!userInfo.id || !bead) return;
    const beadInfo = await beadApi.updateBeadCount(
      userInfo.id,
      bead.count! + quantity,
    );

    setBead(beadInfo);

    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "charge_beads", {
        category: "Bead",
        action: "Charge",
        label: `${quantity} Beads`,
        value: price,
      });
    }
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
                alt={`Image ${button.quantity}`}
                className="w-8 h-8"
              />{" "}
              X {button.quantity}
            </div>
            <div className="text-xl">{button.price}원</div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default BeadPage;
