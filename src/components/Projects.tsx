import { Droplets, BookOpen } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';

export const Projects = () => {
  const { t, language } = useLanguage();
  const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);

  const projects = [
    {
      icon: Droplets,
      title: 'سقيا الجمعية في غزة العزة',
      description: 'مشروع سقيا الجمعية في غزة لتوفير المياه.',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      video: 'https://www.youtube.com/embed/nDQYphxF6UU',
    },
    {
      icon: Droplets,
      title: 'السقاية رقم 11',
      description: 'مشروع السقاية رقم 11 لتوزيع المياه.',
      color: 'from-teal-500 to-green-500',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
      video: 'https://www.youtube.com/embed/86LU416opIc',
    },
    {
      icon: Droplets,
      title: 'سقاية رقم 4',
      description: 'مشروع السقاية رقم 4 لتوفير المياه للمحتاجين.',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      video: 'https://www.youtube.com/embed/ZLop_RsrDBw',
    },
    {
      icon: BookOpen,
      title: 'شرح كتاب الأخضري',
      description: 'شرح مبسط لكتاب الأخضري.',
      color: 'from-orange-500 to-yellow-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      video: 'https://www.youtube.com/embed/fQgr-BUSW1c',
    },
  ];

  return (
    <section id="projects" className="py-20 bg-gray-50 dark:bg-slate-800 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className={`section-title ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t.projects.title}
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mt-10">
            {projects.map((project, index) => {
              const Icon = project.icon;
              return (
                <div
                  key={index}
                  className="group bg-white dark:bg-slate-900 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden transform hover:-translate-y-2 animate-fadeIn"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className={`h-2 bg-gradient-to-r ${project.color}`}></div>
                  <div className="p-8">
                    <div className={`inline-flex p-4 rounded-2xl ${project.bgColor} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-10 h-10 text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className={`text-2xl font-bold mb-4 text-gray-800 dark:text-white ${language === 'ar' ? 'font-arabic' : ''}`}>
                      {project.title}
                    </h3>
                    <p className={`text-gray-600 dark:text-gray-300 leading-relaxed mb-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                      {project.description}
                    </p>

                    {/* عرض مصغر للفيديو مع إمكانية تكبيره */}
                    <div
                      className="cursor-pointer relative pb-[56.25%] h-0 overflow-hidden rounded-xl shadow-lg"
                      onClick={() => setLightboxVideo(project.video)}
                    >
                      <iframe
                        className="absolute top-0 left-0 w-full h-full"
                        src={project.video}
                        title={project.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lightbox للفيديو المكبر */}
      {lightboxVideo && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxVideo(null)}
        >
          <div className="relative w-full max-w-4xl">
            <iframe
              className="w-full h-[60vh] md:h-[80vh] rounded-lg shadow-2xl"
              src={lightboxVideo}
              title="Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
            <button
              onClick={() => setLightboxVideo(null)}
              className="absolute top-2 right-2 text-white text-2xl font-bold hover:text-red-500 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
