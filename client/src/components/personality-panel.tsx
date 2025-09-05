import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Profile } from "@/types";

interface PersonalityPanelProps {
  profile?: Profile;
  onOpenProfileManager: () => void;
  onResetChat: () => void;
}

export default function PersonalityPanel({ 
  profile, 
  onOpenProfileManager, 
  onResetChat 
}: PersonalityPanelProps) {
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="flex-1 p-6 border-t border-border">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Personality Profile</h3>
          <Button
            onClick={onOpenProfileManager}
            variant="ghost"
            size="sm"
            className="text-xs text-primary hover:text-primary/80"
            data-testid="button-open-profile-manager"
          >
            <i className="fas fa-cog"></i>
          </Button>
        </div>

        {/* Current Profile */}
        <Card className="glass-effect p-4 rounded-lg">
          <CardContent className="p-0">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-secondary to-destructive rounded-lg flex items-center justify-center">
                <i className="fas fa-user-tie text-white text-sm"></i>
              </div>
              <div>
                <h4 className="font-medium text-foreground" data-testid="profile-name">
                  {profile?.name || "No Profile Selected"}
                </h4>
                <p className="text-xs text-muted-foreground">Italian Mafioso</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Core Identity:</div>
              <div className="text-xs text-foreground bg-muted/30 p-2 rounded font-mono max-h-20 overflow-y-auto chat-scroll">
                {profile?.coreIdentity 
                  ? truncateText(profile.coreIdentity, 200)
                  : "No personality configured"
                }
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="text-xs text-muted-foreground">Knowledge Base:</div>
              <div className="text-xs text-accent" data-testid="knowledge-base-size">
                {profile?.knowledgeBase 
                  ? `${profile.knowledgeBase.length} characters stored`
                  : "No knowledge base"
                }
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onOpenProfileManager}
            className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-3 rounded-lg text-xs transition-all duration-200"
            data-testid="button-edit-profile"
          >
            <i className="fas fa-edit"></i>
            <span className="ml-1">Edit</span>
          </Button>
          <Button
            onClick={onResetChat}
            variant="secondary"
            className="bg-muted hover:bg-muted/80 text-muted-foreground py-2 px-3 rounded-lg text-xs transition-all duration-200"
            data-testid="button-reset-chat"
          >
            <i className="fas fa-refresh"></i>
            <span className="ml-1">Reset</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
