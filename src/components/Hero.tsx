import { Heart, Users, Video, HeartHandshake } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export const Hero = () => {
  const { t, language } = useLanguage();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="home"
      className="pt-24 pb-16 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300 relative"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* العنوان والنصوص */}
          <div className="mb-8 animate-fadeIn">
            <h1
              className={`text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent ${
                language === "ar" ? "font-arabic" : ""
              }`}
            >
              {t.hero.title}
            </h1>
            <p
              className={`text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-6 leading-relaxed ${
                language === "ar" ? "font-arabic" : ""
              }`}
            >
              {t.hero.subtitle}
            </p>
            <div className="flex flex-col items-center gap-2 text-sm text-gray-600 dark:text-gray-400 animate-slideUp">
              <p className="font-semibold">{t.hero.license}</p>
              <p>{t.hero.date}</p>
            </div>
          </div>

          {/* الأزرار */}
          <div
            className="flex flex-wrap justify-center gap-4 mb-12 animate-slideUp"
            style={{ animationDelay: "0.2s" }}
          >
            <button
              onClick={() => scrollToSection("about")}
              className="btn-primary flex items-center gap-2"
            >
              <Heart className="w-5 h-5" />
              {t.hero.learnMore}
            </button>
            <button
              onClick={() => scrollToSection("donate")}
              className="btn-secondary flex items-center gap-2"
            >
              <HeartHandshake className="w-5 h-5" />
              {t.hero.donateNow}
            </button>
            <button
              onClick={() => scrollToSection("volunteer")}
              className="btn-outline flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              {t.hero.joinVolunteer}
            </button>
          </div>

          {/* الفيديو */}
          <div
            className="max-w-3xl mx-auto animate-fadeIn"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-shadow duration-300">
              {/* خلفية شفافة */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"></div>

              <video
                controls
                playsInline
                className="w-full aspect-video object-cover"
                poster="/DEDE.jpg"
              >
                <source
                  src="https://drive.google.com/uc?export=download&id=1GBaHXcWwql8XYhaijMK8a_H5qD8_HbO3"
                  type="video/mp4"
                />
                متصفحك لا يدعم تشغيل الفيديو.
              </video>

              {/* نص وأيقونة أسفل الفيديو */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 text-white">
                <Video className="w-5 h-5" />
                <span className="font-semibold">{t.hero.watchVideo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* تدرج أسفل القسم */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 to-transparent"></div>
    </section>
  );
};
