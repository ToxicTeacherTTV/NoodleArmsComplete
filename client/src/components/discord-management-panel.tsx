import { useState, useEffect, useCallback, useRef } from "react";
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
import { Users, UserPlus, MessageCircle, Edit2, Save, X, Trash2, Activity, TrendingUp, Clock, Bot, Settings, Plus, Hash, Eye, EyeOff, Shield } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type ProactiveSettings = {
  proactiveEnabled: boolean;
  allowedChannels: string[];
  blockedChannels: string[];
  enabledMessageTypes: string[];
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
  
  // Proactive messaging state
  const [newChannelId, setNewChannelId] = useState("");
  const [channelMode, setChannelMode] = useState<'allowed' | 'blocked'>('allowed');

  // Get Discord servers
  const { data: servers = [], isLoading: serversLoading, isError: serversError, refetch: refetchServers } = useQuery<DiscordServer[]>({
    queryKey: ['/api/discord/servers'],
  });

  // Auto-select if only one server - always use it
  const effectiveServerId = servers.length === 1 ? servers[0]?.serverId : selectedServerId;
  
  // Auto-set selected server immediately when only one server exists
  useEffect(() => {
    if (servers.length === 1 && servers[0] && !selectedServerId) {
      setSelectedServerId(servers[0].serverId);
    }
  }, [servers, selectedServerId]);

  // Get members for selected server
  const { data: members = [], isLoading: membersLoading, isError: membersError, refetch: refetchMembers } = useQuery<DiscordMember[]>({
    queryKey: [`/api/discord/servers/${effectiveServerId}/members`],
    enabled: !!effectiveServerId,
  });

  // Get proactive settings for selected server
  const { data: proactiveSettings, isLoading: proactiveLoading, isError: proactiveError } = useQuery<ProactiveSettings>({
    queryKey: [`/api/discord/servers/${effectiveServerId}/proactive-settings`],
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

  // Update proactive settings
  const updateProactiveSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<ProactiveSettings>) => {
      const response = await fetch(`/api/discord/servers/${effectiveServerId}/proactive-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update proactive settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/discord/servers/${effectiveServerId}/proactive-settings`] });
      toast({ title: "✅ Proactive settings updated!" });
    },
    onError: () => {
      toast({ 
        title: "❌ Failed to update proactive settings", 
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

  // Proactive messaging helper functions
  const handleProactiveToggle = (enabled: boolean) => {
    updateProactiveSettingsMutation.mutate({ proactiveEnabled: enabled });
  };

  const addChannel = () => {
    if (!newChannelId.trim() || !proactiveSettings) return;
    
    const channelId = newChannelId.trim();
    if (channelMode === 'allowed') {
      const updatedChannels = [...proactiveSettings.allowedChannels, channelId];
      updateProactiveSettingsMutation.mutate({ allowedChannels: updatedChannels });
    } else {
      const updatedChannels = [...proactiveSettings.blockedChannels, channelId];
      updateProactiveSettingsMutation.mutate({ blockedChannels: updatedChannels });
    }
    setNewChannelId("");
  };

  const removeChannel = (channelId: string, mode: 'allowed' | 'blocked') => {
    if (!proactiveSettings) return;
    
    if (mode === 'allowed') {
      const updatedChannels = proactiveSettings.allowedChannels.filter(id => id !== channelId);
      updateProactiveSettingsMutation.mutate({ allowedChannels: updatedChannels });
    } else {
      const updatedChannels = proactiveSettings.blockedChannels.filter(id => id !== channelId);
      updateProactiveSettingsMutation.mutate({ blockedChannels: updatedChannels });
    }
  };

  const toggleMessageType = (messageType: string, enabled: boolean) => {
    if (!proactiveSettings) return;
    
    let updatedTypes;
    if (enabled) {
      updatedTypes = [...proactiveSettings.enabledMessageTypes, messageType];
    } else {
      updatedTypes = proactiveSettings.enabledMessageTypes.filter(type => type !== messageType);
    }
    updateProactiveSettingsMutation.mutate({ enabledMessageTypes: updatedTypes });
  };

  const messageTypeOptions = [
    { id: 'dbd', label: 'DBD', icon: '💀', description: 'Dead by Daylight references and gameplay talk' },
    { id: 'italian', label: 'Italian', icon: '🍝', description: 'Italian phrases, pasta references, and cultural content' },
    { id: 'family_business', label: 'Family Business', icon: '👔', description: 'Mafia and family business terminology' },
    { id: 'aggressive', label: 'Aggressive', icon: '😤', description: 'More assertive and confrontational messaging' },
    { id: 'random', label: 'Random', icon: '🎲', description: 'Completely random and chaotic messages' }
  ];

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

            {/* Proactive Messaging Controls */}
            {effectiveServerId && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Proactive Messaging Controls
                </h3>

                {proactiveLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2"></div>
                    <p>Loading proactive settings...</p>
                  </div>
                ) : proactiveError ? (
                  <div className="text-center py-8">
                    <div className="text-center p-4 border border-destructive rounded-md bg-destructive/10">
                      <p className="text-destructive mb-2">Failed to load proactive settings</p>
                    </div>
                  </div>
                ) : proactiveSettings && (
                  <Card data-testid="card-proactive-messaging">
                    <CardContent className="p-4 space-y-6">
                      {/* Master Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-base font-medium flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            Enable Proactive Messaging
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Allow Nicky to initiate conversations randomly across Discord
                          </p>
                        </div>
                        <Switch
                          checked={proactiveSettings.proactiveEnabled}
                          onCheckedChange={handleProactiveToggle}
                          data-testid="switch-proactive-enabled"
                          disabled={updateProactiveSettingsMutation.isPending}
                        />
                      </div>

                      <Separator />

                      {/* Channel Management */}
                      <div className="space-y-4">
                        <Label className="text-base font-medium">Channel Management</Label>
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Allowed Channels (Whitelist) */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4 text-green-600" />
                              <Label className="font-medium text-green-700 dark:text-green-400">
                                Allowed Channels (Whitelist)
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              If set, Nicky will ONLY message in these channels. Leave empty to allow all channels (except blocked ones).
                            </p>
                            
                            <div className="space-y-2">
                              {proactiveSettings.allowedChannels.map((channelId) => (
                                <div key={channelId} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                                  <div className="flex items-center gap-2">
                                    <Hash className="h-3 w-3 text-green-600" />
                                    <span className="text-sm font-mono" data-testid={`text-allowed-channel-${channelId}`}>
                                      {channelId}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeChannel(channelId, 'allowed')}
                                    data-testid={`button-remove-allowed-${channelId}`}
                                    disabled={updateProactiveSettingsMutation.isPending}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              
                              {proactiveSettings.allowedChannels.length === 0 && (
                                <div className="text-center py-4 text-muted-foreground">
                                  <Shield className="h-8 w-8 mx-auto mb-1 opacity-50" />
                                  <p className="text-sm">No allowed channels set</p>
                                  <p className="text-xs">All channels permitted (except blocked)</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Blocked Channels (Blacklist) */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <EyeOff className="h-4 w-4 text-red-600" />
                              <Label className="font-medium text-red-700 dark:text-red-400">
                                Blocked Channels (Blacklist)
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Nicky will NEVER message in these channels, regardless of other settings.
                            </p>
                            
                            <div className="space-y-2">
                              {proactiveSettings.blockedChannels.map((channelId) => (
                                <div key={channelId} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                                  <div className="flex items-center gap-2">
                                    <Hash className="h-3 w-3 text-red-600" />
                                    <span className="text-sm font-mono" data-testid={`text-blocked-channel-${channelId}`}>
                                      {channelId}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeChannel(channelId, 'blocked')}
                                    data-testid={`button-remove-blocked-${channelId}`}
                                    disabled={updateProactiveSettingsMutation.isPending}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              
                              {proactiveSettings.blockedChannels.length === 0 && (
                                <div className="text-center py-4 text-muted-foreground">
                                  <EyeOff className="h-8 w-8 mx-auto mb-1 opacity-50" />
                                  <p className="text-sm">No blocked channels</p>
                                  <p className="text-xs">All channels available</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Add Channel Interface */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Add Channel</Label>
                          <div className="flex gap-2">
                            <Select value={channelMode} onValueChange={(value: 'allowed' | 'blocked') => setChannelMode(value)}>
                              <SelectTrigger className="w-40" data-testid="select-channel-mode">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="allowed">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-3 w-3 text-green-600" />
                                    Allow
                                  </div>
                                </SelectItem>
                                <SelectItem value="blocked">
                                  <div className="flex items-center gap-2">
                                    <EyeOff className="h-3 w-3 text-red-600" />
                                    Block
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Enter channel ID (e.g., 123456789)"
                              value={newChannelId}
                              onChange={(e) => setNewChannelId(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && addChannel()}
                              data-testid="input-new-channel"
                              className="flex-1"
                            />
                            <Button 
                              onClick={addChannel} 
                              size="sm"
                              data-testid="button-add-channel"
                              disabled={!newChannelId.trim() || updateProactiveSettingsMutation.isPending}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Right-click on a Discord channel and select "Copy Channel ID" to get the channel ID.
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Message Type Toggles */}
                      <div className="space-y-4">
                        <Label className="text-base font-medium">Enabled Message Types</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose which types of proactive messages Nicky can send
                        </p>
                        
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {messageTypeOptions.map((messageType) => {
                            const isEnabled = proactiveSettings.enabledMessageTypes.includes(messageType.id);
                            return (
                              <div key={messageType.id} className="flex items-center space-x-3">
                                <Checkbox
                                  id={`message-type-${messageType.id}`}
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => toggleMessageType(messageType.id, !!checked)}
                                  data-testid={`checkbox-message-type-${messageType.id}`}
                                  disabled={updateProactiveSettingsMutation.isPending}
                                />
                                <div className="space-y-1 leading-none">
                                  <Label 
                                    htmlFor={`message-type-${messageType.id}`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <span>{messageType.icon}</span>
                                    <span className="font-medium">{messageType.label}</span>
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {messageType.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Status/Summary */}
                      <div className="mt-4 p-3 bg-muted rounded-md">
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${proactiveSettings.proactiveEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="font-medium">
                              Status: {proactiveSettings.proactiveEnabled ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                          <div className="text-muted-foreground">
                            <span>Message types: {proactiveSettings.enabledMessageTypes.length}/5 enabled</span>
                            <span className="mx-2">•</span>
                            <span>
                              Channels: {
                                proactiveSettings.allowedChannels.length > 0 
                                  ? `${proactiveSettings.allowedChannels.length} allowed` 
                                  : 'All allowed'
                              }
                              {proactiveSettings.blockedChannels.length > 0 && `, ${proactiveSettings.blockedChannels.length} blocked`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
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
                                        <div key={`fact-${fact}-${index}`} className="flex items-center gap-2">
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
                                          <Badge key={`${keyword}-${index}`} variant="secondary" className="flex items-center gap-1">
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
                                          <div key={`${member.id}-fact-${index}`} className="text-sm bg-muted p-2 rounded" data-testid={`text-fact-${index}`}>
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
                                          <Badge key={`${member.id}-keyword-${index}`} variant="outline" className="text-xs" data-testid={`badge-keyword-${index}`}>
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
    refetchInterval: 300000, // Refresh every 5 minutes (reduced from 1 minute for better performance)
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
    onError: (error: any) => {
      console.error('Discord behavior update failed:', error);
      toast({ 
        title: "❌ Failed to update settings", 
        description: error?.message || 'Please try again', 
        variant: "destructive" 
      });
    },
  });

  // Debounce timer ref to prevent rapid API calls
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store pending settings to batch updates
  const pendingSettingsRef = useRef<Partial<BehaviorSettings>>({});
  
  const handleSliderChange = useCallback((setting: keyof BehaviorSettings, value: number[]) => {
    if (!baseline) return;
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Update pending settings
    pendingSettingsRef.current = {
      ...pendingSettingsRef.current,
      [setting]: value[0],
    };
    
    // Set new timer to send update after 500ms of no changes
    debounceTimerRef.current = setTimeout(() => {
      const newSettings = {
        ...baseline,
        ...pendingSettingsRef.current,
      };
      
      updateBehaviorMutation.mutate(newSettings);
      pendingSettingsRef.current = {}; // Clear pending settings
    }, 500);
  }, [baseline, updateBehaviorMutation]);

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