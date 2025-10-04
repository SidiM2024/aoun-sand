import { Heart, Users, Video, HeartHandshake } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

export const Hero = () => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);

  // رابط الفيديو من يوتيوب
  const videoId = "Q0jCQP8YveY";
  const thumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

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

          {/* الفيديو (صورة + زر تشغيل) */}
          <div
            className="max-w-3xl mx-auto animate-fadeIn"
            style={{ animationDelay: "0.4s" }}
          >
            <div
              className="relative rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-shadow duration-300 cursor-pointer"
              onClick={() => setOpen(true)}
            >
              <img
                src={thumb}
                alt="video thumbnail"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <button
                  aria-label="Play video"
                  className="p-4 rounded-full bg-white/90 hover:bg-white"
                >
                  <Video className="w-6 h-6 text-black" />
                </button>
              </div>
              <div className="absolute bottom-4 left-4 z-20 text-white font-semibold">
                {t.hero.watchVideo}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal لعرض الفيديو */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 z-40 text-white bg-black/40 rounded-full p-2"
            >
              ✕
            </button>
            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe
                loading="lazy"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* تدرج أسفل القسم */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 to-transparent"></div>
    </section>
  );
};
