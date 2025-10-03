import { Droplets, BookOpen } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const Projects = () => {
  const { t, language } = useLanguage();

  const projects = [
    {
      icon: Droplets,
      title: t.projects.project1.title,
      description: t.projects.project1.description,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      icon: BookOpen,
      title: t.projects.project2.title,
      description: t.projects.project2.description,
      color: 'from-teal-500 to-green-500',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    },
  ];

  return (
    <section id="projects" className="py-20 bg-gray-50 dark:bg-slate-800 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className={`section-title ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t.projects.title}
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
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
                    <p className={`text-gray-600 dark:text-gray-300 leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`}>
                      {project.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
