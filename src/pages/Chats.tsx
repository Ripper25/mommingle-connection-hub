
import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Navbar from '@/components/layout/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Route, Routes, useParams } from 'react-router-dom';
import ChatList from '@/components/chat/ChatList';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import ConnectedUsersList from '@/components/chat/ConnectedUsersList';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Main Chats Page Component
const ChatsMainPage = () => {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('recent');
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  return (
    <div className="min-h-screen bg-background">
      <Header title="Messages" />
      
      <div className="max-w-md mx-auto pt-2 pb-20">
        {session ? (
          <Tabs 
            defaultValue="recent" 
            className="w-full"
            onValueChange={setActiveTab}
          >
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="recent">Recent Chats</TabsTrigger>
              <TabsTrigger value="connected">Connections</TabsTrigger>
            </TabsList>
            
            <TabsContent value="recent" className="mt-0">
              <ChatList currentUserId={session?.user?.id} />
            </TabsContent>
            
            <TabsContent value="connected" className="mt-0">
              <div className="bg-card rounded-lg overflow-hidden">
                <div className="p-4 bg-muted/50 border-b flex items-center">
                  <Users size={18} className="mr-2 text-nuumi-pink" />
                  <h3 className="font-medium">My Connections</h3>
                </div>
                <ConnectedUsersList currentUserId={session?.user?.id} />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center mt-10">
            <p className="text-muted-foreground">Please sign in to view your messages</p>
          </div>
        )}
      </div>
      
      <Navbar />
    </div>
  );
};

// Conversation Component
const ConversationPage = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [session, setSession] = useState<any>(null);
  const [recipient, setRecipient] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    if (!session || !conversationId) return;
    
    const fetchConversation = async () => {
      setLoading(true);
      
      // Get the other participant
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', session.user.id);
        
      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        toast.error('Failed to load conversation');
        navigate('/chats');
        return;
      }
      
      if (!participants || participants.length === 0) {
        toast.error('Conversation not found');
        navigate('/chats');
        return;
      }
      
      const recipientId = participants[0].user_id;
      
      // Get recipient profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', recipientId)
        .single();
        
      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast.error('Failed to load recipient profile');
      } else if (profile) {
        setRecipient({
          id: profile.id,
          name: profile.display_name || profile.username || 'Anonymous',
          avatar: profile.avatar_url || undefined,
          isOnline: false // Will update with presence later
        });
      }
      
      // Get messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, read')
        .eq('conversation_id', conversationId)
        .order('created_at');
        
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        toast.error('Failed to load messages');
      } else if (messagesData) {
        setMessages(messagesData.map(msg => ({
          id: msg.id,
          content: msg.content,
          timestamp: msg.created_at,
          senderId: msg.sender_id,
          status: msg.read ? 'read' : 'delivered'
        })));
      }
      
      // Mark messages as read
      if (messagesData && messagesData.length > 0) {
        const unreadMessages = messagesData
          .filter(msg => !msg.read && msg.sender_id !== session.user.id)
          .map(msg => msg.id);
          
        if (unreadMessages.length > 0) {
          await supabase
            .from('messages')
            .update({ read: true })
            .in('id', unreadMessages);
        }
      }
      
      setLoading(false);
    };
    
    fetchConversation();
    
    // Set up realtime subscription for new messages
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, 
        async (payload) => {
          // Add the new message to the list
          const newMessage = payload.new as any;
          
          setMessages(current => [
            ...current, 
            {
              id: newMessage.id,
              content: newMessage.content,
              timestamp: newMessage.created_at,
              senderId: newMessage.sender_id,
              status: newMessage.read ? 'read' : 'delivered'
            }
          ]);
          
          // Mark message as read if it's from the other person
          if (newMessage.sender_id !== session.user.id) {
            await supabase
              .from('messages')
              .update({ read: true })
              .eq('id', newMessage.id);
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, session, navigate]);
  
  const handleSendMessage = async (content: string) => {
    if (!session || !conversationId || !content.trim()) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: session.user.id,
          content: content.trim()
        });
        
      if (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };
  
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view your messages</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {recipient && <ChatHeader recipient={recipient} />}
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-nuumi-pink" />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            <MessageList 
              messages={messages} 
              currentUserId={session?.user?.id} 
            />
          </div>
          
          <MessageInput onSendMessage={handleSendMessage} />
        </>
      )}
    </div>
  );
};

// Main Component with Routes
const Chats = () => {
  return (
    <Routes>
      <Route path="/" element={<ChatsMainPage />} />
      <Route path="/:conversationId" element={<ConversationPage />} />
    </Routes>
  );
};

export default Chats;
