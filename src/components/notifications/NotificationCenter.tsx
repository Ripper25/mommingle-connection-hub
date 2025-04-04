
import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationItem from './NotificationItem';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NotificationCenterProps {
  className?: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  const handleClick = async () => {
    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Sign in required",
        description: "Please sign in to view your notifications",
        variant: "destructive"
      });
      navigate('/auth');
      return;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("relative", className)}
          onClick={handleClick}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-nuumi-pink text-[9px] flex items-center justify-center text-white font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 border border-border/30 shadow-lg rounded-xl overflow-hidden" align="end">
        <div className="flex items-center justify-between p-3">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-8"
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
            <Link to="/notifications" onClick={() => setOpen(false)}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-8"
              >
                View all
              </Button>
            </Link>
          </div>
        </div>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-9 px-2 pt-2 bg-transparent">
            <TabsTrigger value="all" className="text-xs rounded-md">All</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs rounded-md">
              Unread
              {unreadCount > 0 && <span className="ml-1 text-nuumi-pink">{unreadCount}</span>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-0">
            <ScrollArea className="h-[350px] overflow-y-auto overscroll-behavior-y-contain" style={{scrollSnapType: 'y mandatory'}}>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex items-start p-3 border-b border-border/10">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="ml-3 flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : notifications.length > 0 ? (
                notifications.slice(0, 5).map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center p-6 text-muted-foreground">
                  No notifications yet
                </div>
              )}
              {notifications.length > 5 && (
                <div className="p-3 text-center">
                  <Link 
                    to="/notifications"
                    className="text-sm text-nuumi-pink hover:underline" 
                    onClick={() => setOpen(false)}
                  >
                    See all notifications
                  </Link>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="unread" className="mt-0">
            <ScrollArea className="h-[350px] overflow-y-auto overscroll-behavior-y-contain" style={{scrollSnapType: 'y mandatory'}}>
              {isLoading ? (
                Array(2).fill(0).map((_, i) => (
                  <div key={i} className="flex items-start p-3 border-b border-border/10">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="ml-3 flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : notifications.filter(n => !n.read).length > 0 ? (
                notifications
                  .filter(notification => !notification.read)
                  .slice(0, 5)
                  .map(notification => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                    />
                  ))
              ) : (
                <div className="flex items-center justify-center p-6 text-muted-foreground">
                  No unread notifications
                </div>
              )}
              {notifications.filter(n => !n.read).length > 5 && (
                <div className="p-3 text-center">
                  <Link 
                    to="/notifications"
                    className="text-sm text-nuumi-pink hover:underline" 
                    onClick={() => setOpen(false)}
                  >
                    See all unread notifications
                  </Link>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
