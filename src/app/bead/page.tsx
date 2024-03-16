"use client";

import React, { useState } from "react";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";
import beadApi from "../api/bead";

const BeadPage: React.FC = () => {
  const { bead, setBead } = useBead();
  const { userInfo } = useUserInfo();

  async function chargeBeads(quantity: number) {
    console.log(userInfo.id, bead.count);
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
          <button
            key={button.quantity}
            onClick={() => chargeBeads(button.quantity)}
            className="border border-orange-500 hover:bg-orange-100 hover:border-orange-100 text-orange-500 font-bold py-2 px-4 rounded"
          >
            <div className="flex items-center">
              <img
                src="bead.png"
                alt={`Image ${button.quantity}`}
                className="w-8 h-8"
              />{" "}
              X {button.quantity}
            </div>
            <div className="text-xl">{button.price}원</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BeadPage;
