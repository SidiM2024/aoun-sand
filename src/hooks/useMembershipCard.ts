import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface MembershipCard {
  id: string;
  user_id: string;
  card_id: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  qr_code_url: string;
}



export const useMembershipCard = () => {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  const fetchCard = async (): Promise<MembershipCard | null> => {
    if (!userProfile) return null;

    const { data, error } = await supabase
      .from('membership_cards')
      .select('*')
      .eq('user_id', userProfile.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching membership card:', error);
      throw error;
    }

    return data;
  };

  const createCard = async (): Promise<MembershipCard> => {
    if (!userProfile) throw new Error('User not found');

    const issueDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(issueDate.getFullYear() + 1); // Valid for 1 year by default

    const cardId = userProfile.unique_short_id;
    if (!cardId) {
      throw new Error('User does not have a membership ID');
    }

    const newCard = {
      user_id: userProfile.id,
      card_id: cardId,
      issue_date: issueDate.toISOString(),
      expiry_date: expiryDate.toISOString(),
      status: 'نشطة',
    };

    const { data, error } = await supabase
      .from('membership_cards')
      .insert(newCard)
      .select()
      .single();

    if (error) {
      console.error('Error creating membership card:', error);
      throw error;
    }

    return data;
  };

  const query = useQuery({
    queryKey: ['membership_card', userProfile?.id],
    queryFn: fetchCard,
    enabled: !!userProfile,
  });

  const generateMutation = useMutation({
    mutationFn: createCard,
    onSuccess: (data) => {
      queryClient.setQueryData(['membership_card', userProfile?.id], data);
    },
  });

  return {
    card: query.data,
    isLoading: query.isLoading,
    error: query.error,
    generateCard: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
  };
};
