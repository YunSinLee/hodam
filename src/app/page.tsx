"use client";

import { useEffect, useState } from "react";

import HomeBackgroundDecor from "@/app/components/home/HomeBackgroundDecor";
import HomeFeaturesSection from "@/app/components/home/HomeFeaturesSection";
import HomeFinalCtaSection from "@/app/components/home/HomeFinalCtaSection";
import HomeHeroSection from "@/app/components/home/HomeHeroSection";
import HomeInfoSection from "@/app/components/home/HomeInfoSection";
import HomeTutorialSection from "@/app/components/home/HomeTutorialSection";
import { HOME_FEATURES } from "@/app/home/home-feature-data";
import {
  HOME_FEATURE_ROTATION_INTERVAL_MS,
  getNextFeatureIndex,
} from "@/app/home/home-feature-rotation";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);

  useEffect(() => {
    setIsLoaded(true);
    const interval = setInterval(() => {
      setCurrentFeature(prev =>
        getNextFeatureIndex(prev, HOME_FEATURES.length),
      );
    }, HOME_FEATURE_ROTATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
    >
      <HomeHeroSection />
      <HomeFeaturesSection
        features={HOME_FEATURES}
        currentFeature={currentFeature}
      />
      <HomeTutorialSection />
      <HomeInfoSection />
      <HomeFinalCtaSection />
      <HomeBackgroundDecor />
    </div>
  );
}
