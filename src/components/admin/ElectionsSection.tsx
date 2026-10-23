import { useState } from 'react';
import { Landmark, Vote } from 'lucide-react';
import { ElectionsAdminTab } from './ElectionsAdminTab';
import { GeneralElectionsAdmin } from './GeneralElectionsAdmin';

// Dashboard «الانتخابات»: the association's general elections (positions, candidacies,
// per-position voting) and the existing simple ballots, side by side.
export const ElectionsSection = () => {
  const [view, setView] = useState<'general' | 'simple'>('general');
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 w-fit">
        {([['general', 'الانتخابات العامة', Landmark], ['simple', 'الاقتراعات البسيطة', Vote]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)} aria-pressed={view === id}
            className={`px-4 py-2 rounded-xl text-sm font-black flex items-center gap-1.5 ${view === id ? 'bg-white dark:bg-slate-900 shadow text-[#211d45] dark:text-white' : 'text-slate-500'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {view === 'general' ? <GeneralElectionsAdmin /> : <ElectionsAdminTab />}
    </div>
  );
};
