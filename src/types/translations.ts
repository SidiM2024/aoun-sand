export interface Translations {
  nav: {
    home: string;
    about: string;
    projects: string;
    volunteer: string;
    donate: string;
    contact: string;
  };
  hero: {
    title: string;
    subtitle: string;
    license: string;
    date: string;
    learnMore: string;
    donateNow: string;
    joinVolunteer: string;
    watchVideo: string;
  };
  about: {
    title: string;
    description: string;
    goalsTitle: string;
    goals: string[];
    teamTitle: string;
    teamDescription: string;
  };
  projects: {
    title: string;
    project1: {
      title: string;
      description: string;
    };
    project2: {
      title: string;
      description: string;
    };
  };
  volunteer: {
    title: string;
    subtitle: string;
    options: string[];
    contact: string;
  };
  donation: {
    title: string;
    subtitle: string;
    banks: string[];
    successTitle: string;
    successMessage: string;
    copyNumber: string;
    contactMessage: string;
    donationNumber: string;
  };
  contact: {
    title: string;
    address: string;
    phone: string;
    email: string;
    follow: string;
  };
  footer: {
    rights: string;
    description: string;
  };
}
