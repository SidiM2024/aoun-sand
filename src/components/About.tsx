import { Target, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState, useRef } from 'react';

export const About = () => {
  const { t, language } = useLanguage();
  const [sectionVisible, setSectionVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  // كشف وصول القسم إلى العرض عند التمرير
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.8) {
        setSectionVisible(true);
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      id="about"
      className="py-20 bg-white dark:bg-slate-900 transition-colors duration-300"
      ref={sectionRef}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">

          {/* العنوان الرئيسي */}
          <h2 className={`section-title text-4xl md:text-5xl font-bold mb-12 text-center transition-all duration-700 ${sectionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t.about.title || "عن جمعية عون وسند"}
          </h2>

          {/* الوصف والفيديو */}
          <div className={`grid lg:grid-cols-2 gap-12 items-center transition-all duration-700 ${sectionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
            {/* الوصف والنص الجذاب */}
            <div className="space-y-6">
              <p className={`text-lg text-gray-700 dark:text-gray-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                جمعية <strong>عون وسند</strong> هي منظمة خيرية تهدف لدعم المجتمعات المحتاجة، وتعزيز روح التعاون والمبادرة الإنسانية. نحن نؤمن بأن التغيير يبدأ بالمشاركة والعطاء، ونعمل على تقديم مساعدات متنوعة تشمل الغذاء، التعليم، والصحة، لنصنع فرقاً حقيقياً في حياة الناس.
              </p>
              <p className={`text-lg text-gray-700 dark:text-gray-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                على مر السنوات، نفذنا مشاريع هادفة بالتعاون مع المتطوعين المحليين، مما جعلنا نقطة مرجعية لكل من يبحث عن المشاركة الفعالة في العمل الخيري داخل موريتانيا.
              </p>

              {/* فيديو التعريف */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                <iframe
                  className="w-full h-64 md:h-96"
                  src="https://www.youtube.com/embed/Q0jCQP8YveY"
                  title="تعريف جمعية عون وسند"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>

            {/* أهداف الجمعية */}
            <div>
              <h3 className={`text-3xl font-bold mb-8 text-teal-600 dark:text-teal-400 flex items-center gap-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
                <Target className="w-8 h-8" />
                أهداف الجمعية
              </h3>
              <div className="space-y-4">
                {t.about.goals.map((goal, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-teal-50 dark:bg-slate-800 rounded-xl hover:bg-teal-100 dark:hover:bg-slate-700 transition-all duration-300 transform hover:translate-x-2"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <p className={`text-gray-700 dark:text-gray-300 ${language === 'ar' ? 'font-arabic text-right flex-1' : ''}`}>
                      {goal}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* فريق الجمعية */}
          <div className={`bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-8 md:p-12 shadow-lg mt-12 transition-all duration-700 ${sectionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
            <div className="flex items-center gap-4 mb-6">
              <Users className="w-10 h-10 text-teal-600 dark:text-teal-400" />
              <h3 className={`text-3xl font-bold text-teal-600 dark:text-teal-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                فريق الجمعية
              </h3>
            </div>
            <p className={`text-lg text-gray-700 dark:text-gray-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
              يتكون فريق <strong>جمعية عون وسند</strong> من مجموعة من المتطوعين المخلصين الذين يعملون بشغف لخدمة المجتمع. نحن نركز على الكفاءة، التعاون، والابتكار لضمان وصول المساعدات لمن يحتاجها بشكل فعال ومستدام.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
