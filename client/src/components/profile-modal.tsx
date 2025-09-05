import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Profile } from "@/types";
import { DEFAULT_PROFILES } from "@/lib/constants";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [currentProfile, setCurrentProfile] = useState<Partial<Profile>>({
    name: "",
    coreIdentity: "",
    knowledgeBase: "",
  });
  const [isDirty, setIsDirty] = useState(false);

  // Queries
  const { data: profiles } = useQuery({
    queryKey: ['/api/profiles'],
    enabled: isOpen,
  });

  const { data: activeProfile } = useQuery({
    queryKey: ['/api/profiles/active'],
    enabled: isOpen,
  });

  // Mutations
  const createProfileMutation = useMutation({
    mutationFn: async (profileData: Partial<Profile>) => {
      const response = await apiRequest('POST', '/api/profiles', profileData);
      return response.json();
    },
    onSuccess: (newProfile) => {
      toast({
        title: "Profile Created",
        description: `Profile "${newProfile.name}" created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      setSelectedProfileId(newProfile.id);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Profile> }) => {
      const response = await apiRequest('PUT', `/api/profiles/${id}`, data);
      return response.json();
    },
    onSuccess: (updatedProfile) => {
      toast({
        title: "Profile Updated",
        description: `Profile "${updatedProfile.name}" updated successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/active'] });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/profiles/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Deleted",
        description: "Profile deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      setSelectedProfileId("");
    },
  });

  const activateProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('PUT', `/api/profiles/${id}/activate`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Activated",
        description: "Profile activated and chat reset",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/active'] });
      onClose();
    },
  });

  // Initialize with active profile
  useEffect(() => {
    if (activeProfile && !selectedProfileId) {
      setSelectedProfileId(activeProfile.id);
      setCurrentProfile({
        name: activeProfile.name,
        coreIdentity: activeProfile.coreIdentity,
        knowledgeBase: activeProfile.knowledgeBase,
      });
    }
  }, [activeProfile, selectedProfileId]);

  // Load selected profile
  useEffect(() => {
    if (selectedProfileId && profiles) {
      const profile = profiles.find((p: Profile) => p.id === selectedProfileId);
      if (profile) {
        setCurrentProfile({
          name: profile.name,
          coreIdentity: profile.coreIdentity,
          knowledgeBase: profile.knowledgeBase,
        });
        setIsDirty(false);
      }
    }
  }, [selectedProfileId, profiles]);

  // Check for changes
  useEffect(() => {
    if (selectedProfileId && profiles) {
      const original = profiles.find((p: Profile) => p.id === selectedProfileId);
      if (original) {
        const hasChanges = (
          currentProfile.name !== original.name ||
          currentProfile.coreIdentity !== original.coreIdentity ||
          currentProfile.knowledgeBase !== original.knowledgeBase
        );
        setIsDirty(hasChanges);
      }
    }
  }, [currentProfile, selectedProfileId, profiles]);

  const handleCreateNewProfile = () => {
    const newProfile = {
      name: "New Profile",
      coreIdentity: DEFAULT_PROFILES.basic.coreIdentity,
      knowledgeBase: "",
    };
    createProfileMutation.mutate(newProfile);
  };

  const handleSaveAndApply = async () => {
    if (!selectedProfileId) return;

    try {
      if (isDirty) {
        await updateProfileMutation.mutateAsync({
          id: selectedProfileId,
          data: currentProfile,
        });
      }
      
      await activateProfileMutation.mutateAsync(selectedProfileId);
    } catch (error) {
      console.error('Save and apply error:', error);
    }
  };

  const handleDeleteProfile = () => {
    if (!selectedProfileId) return;
    
    if (profiles && profiles.length <= 1) {
      toast({
        title: "Cannot Delete",
        description: "You must have at least one profile",
        variant: "destructive",
      });
      return;
    }

    if (confirm("Are you sure you want to delete this profile?")) {
      deleteProfileMutation.mutate(selectedProfileId);
    }
  };

  const handleCancelChanges = () => {
    if (selectedProfileId && profiles) {
      const profile = profiles.find((p: Profile) => p.id === selectedProfileId);
      if (profile) {
        setCurrentProfile({
          name: profile.name,
          coreIdentity: profile.coreIdentity,
          knowledgeBase: profile.knowledgeBase,
        });
        setIsDirty(false);
      }
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-display font-semibold text-foreground">
            Personality Manager
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] space-y-6 pr-2">
          {/* Profile Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Select Profile</label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger data-testid="select-profile">
                <SelectValue placeholder="Select a profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles?.map((profile: Profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name} {profile.isActive && "(Active)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profile Name */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Profile Name</label>
            <Input
              value={currentProfile.name || ""}
              onChange={(e) => setCurrentProfile(prev => ({ ...prev, name: e.target.value }))}
              className="w-full"
              placeholder="Enter profile name"
              data-testid="input-profile-name"
            />
          </div>

          {/* Core Identity */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Core Identity (System Prompt)</label>
            <Textarea
              value={currentProfile.coreIdentity || ""}
              onChange={(e) => setCurrentProfile(prev => ({ ...prev, coreIdentity: e.target.value }))}
              className="w-full font-mono resize-none"
              rows={8}
              placeholder="Define the AI's personality, speaking style, and behavioral patterns..."
              data-testid="textarea-core-identity"
            />
          </div>

          {/* Knowledge Base Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Knowledge Base</label>
              <span className="text-xs text-muted-foreground">
                {currentProfile.knowledgeBase?.length || 0} characters
              </span>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg max-h-32 overflow-y-auto chat-scroll">
              <div className="text-xs text-foreground font-mono">
                {currentProfile.knowledgeBase || "No knowledge base content"}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border bg-muted/30 -mx-6 -mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Button
                onClick={handleCreateNewProfile}
                className="bg-accent hover:bg-accent/90 text-accent-foreground py-2 px-4 rounded-lg text-sm transition-all duration-200"
                disabled={createProfileMutation.isPending}
                data-testid="button-create-new-profile"
              >
                <i className="fas fa-plus mr-1"></i>
                New Profile
              </Button>
              <Button
                onClick={handleDeleteProfile}
                variant="destructive"
                className="bg-destructive/20 hover:bg-destructive/30 text-destructive py-2 px-4 rounded-lg text-sm transition-all duration-200"
                disabled={!selectedProfileId || deleteProfileMutation.isPending}
                data-testid="button-delete-profile"
              >
                <i className="fas fa-trash mr-1"></i>
                Delete
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={handleCancelChanges}
                variant="secondary"
                className="bg-muted hover:bg-muted/80 text-muted-foreground py-2 px-4 rounded-lg text-sm transition-all duration-200"
                data-testid="button-cancel-changes"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAndApply}
                className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg text-sm transition-all duration-200"
                disabled={!selectedProfileId || (!isDirty && selectedProfileId === activeProfile?.id)}
                data-testid="button-save-and-apply"
              >
                {updateProfileMutation.isPending || activateProfileMutation.isPending 
                  ? "Applying..." 
                  : "Apply & Reset Chat"
                }
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
