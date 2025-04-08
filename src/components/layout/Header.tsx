
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MoreVertical, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationCenter from '../notifications/NotificationCenter';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  showSettings?: boolean;
  onSettingsClick?: () => void;
  className?: string;
  rightContent?: React.ReactNode;
}

const Header = ({
  title,
  showBackButton,
  onBackClick,
  showSettings,
  onSettingsClick,
  className,
  rightContent
}: HeaderProps) => {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(-1);
    }
  };
  
  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      setIsSettingsOpen(!isSettingsOpen);
    }
  };

  return (
    <header 
      className={cn(
        "bg-background sticky top-0 z-10 w-full flex items-center justify-between py-4 px-4 shadow-sm",
        "seamless-header", // Apply the seamless style
        className
      )}
    >
      <div className="flex items-center">
        {showBackButton && (
          <button 
            onClick={handleBackClick}
            className="mr-2 rounded-full h-10 w-10 flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        
        {title && (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
      </div>
      
      <div className="flex items-center space-x-1">
        {rightContent}
        
        {showSettings && (
          <button 
            onClick={handleSettingsClick}
            className="action-button hover:bg-secondary transition-colors"
          >
            {isSettingsOpen ? (
              <MoreVertical className="h-5 w-5" />
            ) : (
              <Settings className="h-5 w-5" />
            )}
          </button>
        )}
        
        <NotificationCenter className="action-button" />
      </div>
    </header>
  );
};

export default Header;
