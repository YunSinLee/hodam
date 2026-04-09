export default function HomeTutorialSection() {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-12">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:mb-4 sm:text-4xl">
            호담 사용법
          </h2>
          <p className="text-base text-gray-600 sm:text-lg">
            간단한 영상으로 호담 사용법을 확인해보세요
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-400 to-amber-400 p-1 shadow-2xl">
            <div className="overflow-hidden rounded-xl bg-black">
              <video
                className="aspect-video w-full"
                controls
                autoPlay
                muted
                poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 675'%3E%3Crect width='1200' height='675' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='48' fill='%236b7280'%3E호담 튜토리얼%3C/text%3E%3C/svg%3E"
              >
                <source src="/hodam_tutorial.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
