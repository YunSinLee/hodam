"use client";

import React from "react";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";
import beadApi from "@/app/api/bead";
import HButton from "@/app/components/atomic/HButton";

const BeadPage: React.FC = () => {
  const { bead, setBead } = useBead();
  const { userInfo } = useUserInfo();

  async function chargeBeads(quantity: number) {
    if (!userInfo.id || !bead) return;
    const beadInfo = await beadApi.updateBeadCount(
      userInfo.id,
      bead.count! + quantity,
    );

    setBead(beadInfo);
  }

  const buttonData = [
    { quantity: 5, price: 2500 },
    { quantity: 10, price: 5000 },
    { quantity: 20, price: 10000 },
    { quantity: 100, price: 50000 },
  ];

  return (
    <div className="flex flex-col items-center">
      <img src="bead.png" alt="Bead" className="w-24 h-24" />
      <p className="text-xl font-bold">Bead Count: {bead.count}</p>
      <div className="space-x-4">
        {buttonData.map(button => (
          <HButton
            key={button.quantity}
            children={
              <div>
                <div className="flex items-center">
                  <img
                    src="bead.png"
                    alt={`Image ${button.quantity}`}
                    className="w-8 h-8"
                  />{" "}
                  X {button.quantity}
                </div>
                <div className="text-xl">{button.price}원</div>
              </div>
            }
            onClick={() => chargeBeads(button.quantity)}
            style="outlined"
          />
        ))}
      </div>
    </div>
  );
};

export default BeadPage;
