import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, MessageCircle, Edit2, Save, X, Trash2, Activity, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

type DiscordServer = {
  id: string;
  serverId: string;
  serverName: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

type DiscordMember = {
  id: string;
  userId: string;
  username: string;
  nickname?: string;
  facts?: string[];
  keywords?: string[];
  lastInteraction?: string;
  interactionCount: number;
  createdAt: string;
  updatedAt: string;
};

type BehaviorSettings = {
  aggressiveness: number;
  responsiveness: number;
  italianIntensity: number;
  dbdObsession: number;
  familyBusinessMode: number;
};

type EffectiveBehavior = {
  aggressiveness: number;
  responsiveness: number;
  italianIntensity: number;
  dbdObsession: number;
  familyBusinessMode: number;
  lastUpdated: string;
  driftFactors: {
    timeOfDay: number;
    recentActivity: number;
    chaosMultiplier: number;
  };
};

export default function DiscordManagementPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [editingMemberId, setEditingMemberId] = useState<string>("");
  const [editFacts, setEditFacts] = useState<string[]>([]);
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [newFact, setNewFact] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  // Get Discord servers
  const { data: servers = [], isLoading: serversLoading, isError: serversError, refetch: refetchServers } = useQuery<DiscordServer[]>({
    queryKey: ['/api/discord/servers'],
  });

  // Auto-select if only one server
  const autoSelectedServerId = servers.length === 1 ? servers[0]?.serverId : selectedServerId;
  const effectiveServerId = autoSelectedServerId || selectedServerId;
  
  // Auto-select the only server on load
  if (servers.length === 1 && !selectedServerId && servers[0]) {
    setSelectedServerId(servers[0].serverId);
  }

  // Get members for selected server
  const { data: members = [], isLoading: membersLoading, isError: membersError, refetch: refetchMembers } = useQuery<DiscordMember[]>({
    queryKey: [`/api/discord/servers/${effectiveServerId}/members`],
    enabled: !!effectiveServerId,
  });

  // Update member facts
  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, facts, keywords }: { id: string; facts: string[]; keywords: string[] }) => {
      const response = await fetch(`/api/discord/members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts, keywords }),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/discord/servers/${effectiveServerId}/members`] });
      setEditingMemberId("");
      toast({ title: "✅ Member facts updated!" });
    },
    onError: () => {
      toast({ 
        title: "❌ Failed to update member", 
        variant: "destructive" 
      });
    },
  });

  const startEditing = (member: DiscordMember) => {
    setEditingMemberId(member.id);
    setEditFacts([...(member.facts || [])]);
    setEditKeywords([...(member.keywords || [])]);
    setNewFact("");
    setNewKeyword("");
  };

  const cancelEditing = () => {
    setEditingMemberId("");
    setEditFacts([]);
    setEditKeywords([]);
  };

  const saveMember = () => {
    updateMemberMutation.mutate({
      id: editingMemberId,
      facts: editFacts,
      keywords: editKeywords,
    });
  };

  const addFact = () => {
    if (newFact.trim()) {
      setEditFacts([...editFacts, newFact.trim()]);
      setNewFact("");
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      setEditKeywords([...editKeywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeFact = (index: number) => {
    setEditFacts(editFacts.filter((_, i) => i !== index));
  };

  const removeKeyword = (index: number) => {
    setEditKeywords(editKeywords.filter((_, i) => i !== index));
  };

  const activeServer = servers.find(s => s.serverId === effectiveServerId);

  return (
    <div className="space-y-6">
      <Card data-testid="card-discord-management">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Discord User Management
            <Badge variant="secondary">
              {members.length} users tracked
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Server Selection - Only show if multiple servers */}
            {servers.length > 1 && (
              <div>
                <Label>Discord Server</Label>
                {serversLoading ? (
                  <div className="w-full p-2 border rounded-md bg-muted flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
                    Loading servers...
                  </div>
                ) : serversError ? (
                  <div className="w-full p-2 border border-destructive rounded-md bg-destructive/10 flex items-center justify-between">
                    <span className="text-destructive">Failed to load servers</span>
                    <Button size="sm" variant="outline" onClick={() => refetchServers()}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <select
                    data-testid="select-discord-server"
                    className="w-full p-2 border rounded-md bg-background"
                    value={selectedServerId}
                    onChange={(e) => setSelectedServerId(e.target.value)}
                  >
                    <option value="">Select a Discord server...</option>
                    {servers.map((server) => (
                      <option key={server.id} value={server.serverId}>
                        {server.serverName} ({server.memberCount} members)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {activeServer && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <h3 className="font-semibold">{activeServer.serverName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {activeServer.memberCount} members • Active since {format(new Date(activeServer.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>
                
                <DynamicBehaviorPanel serverId={activeServer.serverId} />
              </div>
            )}

            {/* Members List */}
            {effectiveServerId && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Discord Members ({members.length})
                </h3>

                {membersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2"></div>
                    <p>Loading Discord members...</p>
                  </div>
                ) : membersError ? (
                  <div className="text-center py-8">
                    <div className="text-center p-4 border border-destructive rounded-md bg-destructive/10">
                      <p className="text-destructive mb-2">Failed to load Discord members</p>
                      <Button size="sm" variant="outline" onClick={() => refetchMembers()}>
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No Discord members found.</p>
                    <p className="text-sm">Members appear here after they interact with Nicky.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <Card key={member.id} className="relative">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold" data-testid={`text-username-${member.id}`}>
                                  {member.username}
                                  {member.nickname && (
                                    <span className="text-sm text-muted-foreground ml-2">
                                      ({member.nickname})
                                    </span>
                                  )}
                                </h4>
                                <Badge variant="outline" data-testid={`badge-interactions-${member.id}`}>
                                  {member.interactionCount} interactions
                                </Badge>
                              </div>

                              {editingMemberId === member.id ? (
                                <div className="space-y-4 p-4 bg-muted rounded-md">
                                  {/* Edit Facts */}
                                  <div>
                                    <Label className="text-sm font-medium">Facts about {member.username}</Label>
                                    <div className="space-y-2">
                                      {editFacts.map((fact, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                          <span className="text-sm flex-1 p-2 bg-background rounded border">
                                            {fact}
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeFact(index)}
                                            data-testid={`button-remove-fact-${index}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Add a new fact (e.g., 'loves pineapple pizza', 'terrible at Twins')"
                                          value={newFact}
                                          onChange={(e) => setNewFact(e.target.value)}
                                          onKeyDown={(e) => e.key === 'Enter' && addFact()}
                                          data-testid="input-new-fact"
                                        />
                                        <Button onClick={addFact} size="sm" data-testid="button-add-fact">
                                          <UserPlus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Edit Keywords */}
                                  <div>
                                    <Label className="text-sm font-medium">Keywords (triggers responses)</Label>
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap gap-1">
                                        {editKeywords.map((keyword, index) => (
                                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                            {keyword}
                                            <X 
                                              className="h-3 w-3 cursor-pointer" 
                                              onClick={() => removeKeyword(index)}
                                              data-testid={`button-remove-keyword-${index}`}
                                            />
                                          </Badge>
                                        ))}
                                      </div>
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Add keyword (e.g., 'pizza', 'twins', 'noob')"
                                          value={newKeyword}
                                          onChange={(e) => setNewKeyword(e.target.value)}
                                          onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                                          data-testid="input-new-keyword"
                                        />
                                        <Button onClick={addKeyword} size="sm" data-testid="button-add-keyword">
                                          <UserPlus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Save/Cancel Buttons */}
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={cancelEditing} data-testid="button-cancel-edit">
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={saveMember}
                                      disabled={updateMemberMutation.isPending}
                                      data-testid="button-save-member"
                                    >
                                      <Save className="h-4 w-4 mr-1" />
                                      {updateMemberMutation.isPending ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Display Facts */}
                                  {member.facts && member.facts.length > 0 ? (
                                    <div>
                                      <Label className="text-xs font-medium text-muted-foreground">Facts:</Label>
                                      <div className="space-y-1">
                                        {member.facts.map((fact, index) => (
                                          <div key={index} className="text-sm bg-muted p-2 rounded" data-testid={`text-fact-${index}`}>
                                            • {fact}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">No facts recorded yet</p>
                                  )}

                                  {/* Display Keywords */}
                                  {member.keywords && member.keywords.length > 0 && (
                                    <div>
                                      <Label className="text-xs font-medium text-muted-foreground">Keywords:</Label>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {member.keywords.map((keyword, index) => (
                                          <Badge key={index} variant="outline" className="text-xs" data-testid={`badge-keyword-${index}`}>
                                            {keyword}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {member.lastInteraction && (
                                    <p className="text-xs text-muted-foreground">
                                      Last interaction: {format(new Date(member.lastInteraction), 'MMM dd, yyyy HH:mm')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Edit Button */}
                            {editingMemberId !== member.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(member)}
                                data-testid={`button-edit-member-${member.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">💡 How Discord User Management Works</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Users appear here automatically after interacting with Nicky in Discord</li>
              <li>• Add funny or real facts about users - Nicky will reference them in responses</li>
              <li>• Keywords trigger Nicky to respond when those words are mentioned</li>
              <li>• Example facts: "thinks pineapple belongs on pizza", "terrible at Dead by Daylight", "owns 50 cats"</li>
              <li>• Be creative! Nicky will roast them about whatever you add 😈</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Dynamic Behavior Panel Component
function DynamicBehaviorPanel({ serverId }: { serverId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get baseline behavior settings
  const { data: baseline, isLoading: baselineLoading, refetch: refetchBaseline } = useQuery<BehaviorSettings>({
    queryKey: [`/api/discord/servers/${serverId}/behavior`],
    enabled: !!serverId,
  });

  // Get effective (live) behavior values 
  const { data: effective, isLoading: effectiveLoading, refetch: refetchEffective } = useQuery<EffectiveBehavior>({
    queryKey: [`/api/discord/servers/${serverId}/effective-behavior`],
    enabled: !!serverId,
    refetchInterval: 60000, // Refresh every minute to show live changes
  });

  // Update baseline settings
  const updateBehaviorMutation = useMutation({
    mutationFn: async (newSettings: BehaviorSettings) => {
      const response = await fetch(`/api/discord/servers/${serverId}/behavior`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/discord/servers/${serverId}/behavior`] });
      queryClient.invalidateQueries({ queryKey: [`/api/discord/servers/${serverId}/effective-behavior`] });
      toast({ title: "✅ Behavior settings updated!" });
    },
    onError: () => {
      toast({ 
        title: "❌ Failed to update settings", 
        variant: "destructive" 
      });
    },
  });

  const handleSliderChange = (setting: keyof BehaviorSettings, value: number[]) => {
    if (!baseline) return;
    
    const newSettings = {
      ...baseline,
      [setting]: value[0],
    };
    
    updateBehaviorMutation.mutate(newSettings);
  };

  if (baselineLoading || effectiveLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Nicky's Discord Personality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
            Loading dynamic behavior settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!baseline || !effective) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Nicky's Discord Personality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground">Unable to load behavior settings</p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => { refetchBaseline(); refetchEffective(); }}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const behaviorItems = [
    { 
      key: 'aggressiveness' as keyof BehaviorSettings, 
      label: 'Aggressiveness', 
      icon: '🔥', 
      description: 'How confrontational and hostile Nicky gets' 
    },
    { 
      key: 'responsiveness' as keyof BehaviorSettings, 
      label: 'Responsiveness', 
      icon: '⚡', 
      description: 'How often he responds to messages' 
    },
    { 
      key: 'italianIntensity' as keyof BehaviorSettings, 
      label: 'Italian Intensity', 
      icon: '🇮🇹', 
      description: 'How much Italian language and expressions he uses' 
    },
    { 
      key: 'dbdObsession' as keyof BehaviorSettings, 
      label: 'DBD Obsession', 
      icon: '💀', 
      description: 'How often he relates everything to Dead by Daylight' 
    },
    { 
      key: 'familyBusinessMode' as keyof BehaviorSettings, 
      label: 'Family Business Mode', 
      icon: '👔', 
      description: 'How often he uses mafia/family business terminology' 
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Nicky's Discord Personality
          <Badge variant="outline" className="ml-auto">
            <TrendingUp className="h-3 w-3 mr-1" />
            Dynamic
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Adjust baseline settings - values change automatically based on time, activity, and chaos mode
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dynamic Status */}
        <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">Live Status:</span>
            <span className="ml-2">
              Time influence: {effective.driftFactors.timeOfDay > 0 ? 'Boosted' : effective.driftFactors.timeOfDay < 0 ? 'Dampened' : 'Normal'}
            </span>
            <span className="mx-2">•</span>
            <span>
              Chaos mode: {effective.driftFactors.chaosMultiplier > 1 ? 'Amplified' : effective.driftFactors.chaosMultiplier < 1 ? 'Suppressed' : 'Baseline'}
            </span>
          </div>
        </div>

        {/* Behavior Sliders */}
        <div className="space-y-4">
          {behaviorItems.map((item) => {
            const baselineValue = baseline[item.key];
            const effectiveValue = effective[item.key];
            const isDifferent = Math.abs(baselineValue - effectiveValue) > 2;

            return (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    {item.label}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Baseline: {baselineValue}%
                    </Badge>
                    {isDifferent && (
                      <Badge variant="secondary" className="text-xs">
                        Live: {effectiveValue}%
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="relative">
                  <Slider
                    value={[baselineValue]}
                    onValueChange={(value) => handleSliderChange(item.key, value)}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={updateBehaviorMutation.isPending}
                  />
                  
                  {/* Show effective value indicator if different */}
                  {isDifferent && (
                    <div 
                      className="absolute top-1 w-2 h-2 bg-green-500 rounded-full transform -translate-x-1"
                      style={{ left: `${effectiveValue}%` }}
                      title={`Live effective value: ${effectiveValue}%`}
                    />
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Last Update Info */}
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {format(new Date(effective.lastUpdated), 'MMM dd, h:mm a')}
          <span className="mx-2">•</span>
          Values refresh automatically every minute
        </div>
      </CardContent>
    </Card>
  );
}