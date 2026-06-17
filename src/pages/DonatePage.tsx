import { Donation } from '../components/Donation';
import { DonationExpensesViewer } from '../components/DonationExpensesViewer';

export const DonatePage = () => {
  return (
    <div className="pt-20 pb-20">
      <Donation />
      <DonationExpensesViewer />
    </div>
  );
};
