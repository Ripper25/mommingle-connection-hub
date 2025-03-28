import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import Post from '@/components/shared/Post';
import StoriesRow from '@/components/story/StoriesRow';
import { supabase } from '@/integrations/supabase/client';
import { StoryItem } from '@/components/story/Story';
import { Skeleton } from '@/components/ui/skeleton';

interface PostType {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  isLiked: boolean;
}

const Feed = () => {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: stories, isLoading: storiesLoading } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select(`
          id,
          image_url,
          caption,
          created_at,
          user_id
        `)
        .lt('expires_at', now)
        .order('created_at', { ascending: false });
        
      if (storiesError) {
        console.error('Error fetching stories:', storiesError);
        throw storiesError;
      }
      
      const storiesWithProfiles = await Promise.all(storiesData.map(async (story) => {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .eq('id', story.user_id)
          .single();
          
        if (profileError) {
          console.error('Error fetching profile for story:', profileError);
          return null;
        }
        
        return {
          id: story.id,
          user: {
            id: profileData.id,
            name: profileData.display_name || profileData.username,
            username: profileData.username,
            avatar: profileData.avatar_url
          },
          imageUrl: story.image_url,
          caption: story.caption,
          createdAt: story.created_at
        };
      }));
      
      return storiesWithProfiles.filter(Boolean) as StoryItem[];
    },
    enabled: !!session,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false });
        
      if (postsError) {
        console.error('Error fetching posts:', postsError);
        throw postsError;
      }
      
      const postsWithProfilesAndCounts = await Promise.all(postsData.map(async (post) => {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, is_verified')
          .eq('id', post.user_id)
          .single();
          
        if (profileError) {
          console.error('Error fetching profile for post:', profileError);
          return null;
        }
        
        const { count: likesCount, error: likesError } = await supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id);
          
        if (likesError) {
          console.error('Error fetching likes count:', likesError);
        }
        
        const { count: commentsCount, error: commentsError } = await supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id);
          
        if (commentsError) {
          console.error('Error fetching comments count:', commentsError);
        }
        
        const { count: repostsCount, error: repostsError } = await supabase
          .from('reposts')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id);
          
        if (repostsError) {
          console.error('Error fetching reposts count:', repostsError);
        }
        
        let isLiked = false;
        if (session?.user?.id) {
          const { data: likeData, error: likeError } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          if (likeError) {
            console.error('Error fetching like status:', likeError);
          }
          isLiked = !!likeData;
        }
        
        return {
          id: post.id,
          content: post.content,
          image_url: post.image_url,
          created_at: post.created_at,
          author: {
            id: profileData.id,
            name: profileData.display_name || profileData.username,
            username: profileData.username,
            avatar_url: profileData.avatar_url,
            is_verified: profileData.is_verified
          },
          likes_count: likesCount || 0,
          comments_count: commentsCount || 0,
          reposts_count: repostsCount || 0,
          isLiked
        };
      }));
      
      return postsWithProfilesAndCounts.filter(Boolean) as PostType[];
    },
    enabled: !!session
  });

  const handleLike = async (postId: string) => {
    if (!session) {
      toast.error('Please sign in to like posts');
      return;
    }
    
    const post = posts?.find(p => p.id === postId);
    if (!post) return;
    
    try {
      if (post.isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', session.user.id);
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({
            post_id: postId,
            user_id: session.user.id
          });
          
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like status');
    }
  };

  const handleComment = (postId: string) => {
    if (!session) {
      toast.error('Please sign in to comment');
      return;
    }
    console.log(`Comment on post ${postId}`);
  };

  const handleRepost = async (postId: string) => {
    if (!session) {
      toast.error('Please sign in to repost');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('reposts')
        .insert({
          post_id: postId,
          user_id: session.user.id
        });
        
      if (error) throw error;
      
      toast.success('Post shared to your profile');
    } catch (error) {
      console.error('Error reposting:', error);
      toast.error('Failed to repost');
    }
  };

  const handleShare = (postId: string) => {
    console.log(`Share post ${postId}`);
    if (navigator.share) {
      navigator.share({
        title: 'Check out this post on nuumi',
        text: 'I found this interesting post on nuumi',
        url: `${window.location.origin}/post/${postId}`,
      }).catch(err => console.error('Error sharing:', err));
    } else {
      toast.success('Post link copied to clipboard');
    }
  };

  if (!session && !postsLoading && !storiesLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        
        <div className="max-w-md mx-auto px-4 mt-4 text-center">
          <h2 className="text-lg font-semibold mb-2">Welcome to nuumi</h2>
          <p className="text-muted-foreground mb-4">Sign in to see posts from other moms</p>
          {/* Auth buttons would go here */}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <div className="max-w-md mx-auto">
        <StoriesRow 
          stories={stories || []} 
          isLoading={storiesLoading} 
          className="mb-4 mt-2"
        />
      </div>
      
      <div className="max-w-md mx-auto px-4">
        {postsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 mb-3">
              <div className="flex items-start mb-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="ml-3 flex flex-col gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-24 w-full mb-3" />
              <div className="flex justify-between">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-8" />
              </div>
            </div>
          ))
        ) : posts && posts.length > 0 ? (
          posts.map((post) => (
            <Post
              key={post.id}
              author={{
                name: post.author.name,
                username: post.author.username,
                avatar: post.author.avatar_url || undefined,
                isVerified: post.author.is_verified,
                timeAgo: new Date(post.created_at).toLocaleDateString()
              }}
              content={post.content}
              image={post.image_url || undefined}
              likes={post.likes_count}
              comments={post.comments_count}
              reposts={post.reposts_count}
              isLiked={post.isLiked}
              onLike={() => handleLike(post.id)}
              onComment={() => handleComment(post.id)}
              onRepost={() => handleRepost(post.id)}
              onShare={() => handleShare(post.id)}
            />
          ))
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No posts to show</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
