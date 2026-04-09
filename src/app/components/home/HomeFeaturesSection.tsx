export interface HomeFeature {
  icon: string;
  title: string;
  description: string;
}

interface HomeFeaturesSectionProps {
  features: HomeFeature[];
  currentFeature: number;
}

export default function HomeFeaturesSection({
  features,
  currentFeature,
}: HomeFeaturesSectionProps) {
  return (
    <section className="bg-white/50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-12">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:mb-4 sm:text-4xl">
            호담의 특별한 기능들
          </h2>
          <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
            최신 AI 기술로 만드는 개인 맞춤형 동화 서비스
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:gap-8">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`relative rounded-2xl border border-gray-100 bg-white p-5 shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-xl sm:p-6 md:hover:-translate-y-2 ${
                currentFeature === index ? "ring-2 ring-orange-400/50" : ""
              }`}
            >
              <div className="text-center">
                <div className="mb-3 text-3xl sm:mb-4 sm:text-4xl">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 sm:text-base">
                  {feature.description}
                </p>
              </div>
              {currentFeature === index && (
                <div className="absolute -right-2 -top-2 h-6 w-6 animate-pulse rounded-full bg-orange-400" />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
