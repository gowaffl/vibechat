import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/authClient";
import { useUser } from "@/contexts/UserContext";

export type FeatureRequestStatus = 'pending' | 'planned' | 'in_progress' | 'completed' | 'rejected';

export interface FeatureRequest {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  upvotes: number;
  downvotes: number;
  score: number;
  createdAt: string;
  updatedAt: string;
  userVote?: 'up' | 'down' | null;
}

export interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  version: string | null;
  publishedAt: string;
}

export const useFeatureRequests = (sortBy: 'score' | 'newest' = 'score', statusFilter?: 'roadmap' | 'requests') => {
  const { user } = useUser();

  return useQuery({
    queryKey: ['feature-requests', sortBy, statusFilter, user?.id],
    queryFn: async () => {
      let query = supabaseClient
        .from('feature_request')
        .select(`
          *,
          user_vote:feature_vote(voteType)
        `);

      // Filter based on tab
      if (statusFilter === 'roadmap') {
        query = query.in('status', ['planned', 'in_progress']);
      } else {
        // Requests tab shows pending, and maybe completed/rejected if we want, 
        // but typically "Requests" means open suggestions.
        // Let's include everything NOT in roadmap for now, or just pending?
        // User said: "switches it from feedback request and it tabs it over to roadmap, so people can see if something is already in production or not"
        // So Roadmap = Planned/In Progress/Completed? 
        // Let's make Roadmap = Planned, In Progress. 
        // Requests = Pending.
        // Completed could be in Roadmap or Changelog. Changelog is "most recent changes... completed".
        // Let's put Pending in Requests.
        query = query.eq('status', 'pending');
      }

      // Sort
      if (sortBy === 'score') {
        query = query.order('score', { ascending: false });
      } else {
        query = query.order('createdAt', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map user vote
      return data.map((item: any) => ({
        ...item,
        userVote: item.user_vote?.[0]?.voteType || null
      })) as FeatureRequest[];
    },
    enabled: !!user,
  });
};

export const useCreateRequest = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabaseClient
        .from('feature_request')
        .insert({
          userId: user.id,
          title,
          description,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-requests'] });
    }
  });
};

export const useVoteRequest = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: async ({ requestId, voteType }: { requestId: string; voteType: 'up' | 'down' }) => {
      if (!user) throw new Error("User not authenticated");

      // Check if vote exists
      const { data: existingVote } = await supabaseClient
        .from('feature_vote')
        .select('*')
        .eq('userId', user.id)
        .eq('requestId', requestId)
        .single();

      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Toggle off (remove vote)
          const { error } = await supabaseClient
            .from('feature_vote')
            .delete()
            .eq('id', existingVote.id);
          if (error) throw error;
        } else {
          // Change vote
          const { error } = await supabaseClient
            .from('feature_vote')
            .update({ voteType })
            .eq('id', existingVote.id);
          if (error) throw error;
        }
      } else {
        // Create new vote
        const { error } = await supabaseClient
          .from('feature_vote')
          .insert({
            userId: user.id,
            requestId,
            voteType
          });
        if (error) throw error;
      }
    },
    onMutate: async ({ requestId, voteType }) => {
      // Optimistic update could go here, but strict consistency is fine for now
      await queryClient.cancelQueries({ queryKey: ['feature-requests'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-requests'] });
    }
  });
};

export const useChangelog = () => {
  return useQuery({
    queryKey: ['changelog'],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from('changelog_entry')
        .select('*')
        .order('publishedAt', { ascending: false });

      if (error) throw error;
      return data as ChangelogEntry[];
    }
  });
};
