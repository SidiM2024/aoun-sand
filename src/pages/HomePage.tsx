import { Hero } from '../components/Hero';
import { ActivePollsWidget } from '../components/ActivePollsWidget';

export const HomePage = () => {
  return (
    <div className="overflow-hidden">
      <Hero />
      <div className="container-custom max-w-4xl mx-auto py-12">
        <ActivePollsWidget />
      </div>
    </div>
  );
};
