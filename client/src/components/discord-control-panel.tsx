import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Settings, Users, MessageSquare, Plus, Trash2, Edit, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DiscordServer {
  id: string;
  serverId: string;
  serverName: string;
  isActive: boolean;
  aggressiveness: number;
  responsiveness: number;
  italianIntensity: number;
  dbdObsession: number;
  familyBusinessMode: number;
}

interface DiscordMember {
  id: string;
  userId: string;
  username: string;
  nickname?: string;
  facts: string[];
  keywords: string[];
  interactionCount: number;
  lastInteraction?: string;
}

interface DiscordTopicTrigger {
  id: string;
  topic: string;
  category: 'HIGH' | 'MEDIUM' | 'LOW';
  responseChance: number;
  keywords: string[];
  customResponse?: string;
  isActive: boolean;
  triggerCount: number;
  lastTriggered?: string;
}

export default function DiscordControlPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [showAddTriggerDialog, setShowAddTriggerDialog] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    topic: '',
    category: 'MEDIUM' as const,
    responseChance: 75,
    keywords: [] as string[],
    customResponse: '',
  });

  // Get Discord bot status
  const { data: botStatus } = useQuery({
    queryKey: ['/api/discord/status'],
    refetchInterval: 10000, // Check every 10 seconds
  });

  // Get Discord servers
  const { data: discordServers = [] } = useQuery<DiscordServer[]>({
    queryKey: ['/api/discord/servers'],
    refetchInterval: 30000,
  });

  // Get server members
  const { data: serverMembers = [] } = useQuery<DiscordMember[]>({
    queryKey: ['/api/discord/servers', selectedServer, 'members'],
    enabled: !!selectedServer,
  });

  // Get topic triggers
  const { data: topicTriggers = [] } = useQuery<DiscordTopicTrigger[]>({
    queryKey: ['/api/discord/servers', selectedServer, 'triggers'],
    enabled: !!selectedServer,
  });

  // Update server behavior mutation
  const updateBehaviorMutation = useMutation({
    mutationFn: async ({ serverId, updates }: { serverId: string; updates: any }) => {
      return apiRequest(`/api/discord/servers/${serverId}/behavior`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/discord/servers'] });
      toast({
        title: "Behavior Updated",
        description: "Nicky's Discord behavior has been updated!",
      });
    },
  });

  // Add topic trigger mutation
  const addTriggerMutation = useMutation({
    mutationFn: async (triggerData: any) => {
      return apiRequest(`/api/discord/servers/${selectedServer}/triggers`, {
        method: 'POST',
        body: JSON.stringify(triggerData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/discord/servers', selectedServer, 'triggers'] });
      setShowAddTriggerDialog(false);
      setNewTrigger({
        topic: '',
        category: 'MEDIUM',
        responseChance: 75,
        keywords: [],
        customResponse: '',
      });
      toast({
        title: "Trigger Added",
        description: "New topic trigger created successfully!",
      });
    },
  });

  // Delete topic trigger mutation
  const deleteTriggerMutation = useMutation({
    mutationFn: async (triggerId: string) => {
      return apiRequest(`/api/discord/triggers/${triggerId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/discord/servers', selectedServer, 'triggers'] });
      toast({
        title: "Trigger Deleted",
        description: "Topic trigger removed successfully!",
      });
    },
  });

  const selectedServerData = discordServers.find(s => s.id === selectedServer);

  const handleBehaviorUpdate = (key: string, value: number) => {
    if (!selectedServer) return;
    
    updateBehaviorMutation.mutate({
      serverId: selectedServer,
      updates: { [key]: value },
    });
  };

  const handleAddTrigger = () => {
    addTriggerMutation.mutate(newTrigger);
  };

  return (
    <div className="space-y-6">
      {/* Discord Bot Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {botStatus?.connected ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            Discord Bot Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={botStatus?.connected ? "default" : "destructive"}>
              {botStatus?.connected ? "Online" : "Offline"}
            </Badge>
            {!botStatus?.connected && (
              <p className="text-sm text-muted-foreground">
                Add DISCORD_BOT_TOKEN to your secrets to connect
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Server Selection */}
      {discordServers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Discord Server</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedServer} onValueChange={setSelectedServer}>
              <SelectTrigger data-testid="select-discord-server">
                <SelectValue placeholder="Select a Discord server..." />
              </SelectTrigger>
              <SelectContent>
                {discordServers.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    {server.serverName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {selectedServerData && (
        <Tabs defaultValue="behavior" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="behavior" data-testid="tab-discord-behavior">
              <Settings className="h-4 w-4 mr-2" />
              Behavior
            </TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-discord-members">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="triggers" data-testid="tab-discord-triggers">
              <MessageSquare className="h-4 w-4 mr-2" />
              Triggers
            </TabsTrigger>
          </TabsList>

          {/* Behavior Controls */}
          <TabsContent value="behavior" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Nicky's Discord Personality</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Adjust how Nicky behaves in this Discord server
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">
                      🎭 Aggressiveness ({selectedServerData.aggressiveness}%)
                    </label>
                    <Slider
                      value={[selectedServerData.aggressiveness]}
                      onValueChange={([value]) => handleBehaviorUpdate('aggressiveness', value)}
                      max={100}
                      step={1}
                      className="mt-2"
                      data-testid="slider-aggressiveness"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      🗣️ Responsiveness ({selectedServerData.responsiveness}%)
                    </label>
                    <Slider
                      value={[selectedServerData.responsiveness]}
                      onValueChange={([value]) => handleBehaviorUpdate('responsiveness', value)}
                      max={100}
                      step={1}
                      className="mt-2"
                      data-testid="slider-responsiveness"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      🍝 Italian Intensity ({selectedServerData.italianIntensity}%)
                    </label>
                    <Slider
                      value={[selectedServerData.italianIntensity]}
                      onValueChange={([value]) => handleBehaviorUpdate('italianIntensity', value)}
                      max={100}
                      step={1}
                      className="mt-2"
                      data-testid="slider-italian-intensity"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      🎮 DBD Obsession ({selectedServerData.dbdObsession}%)
                    </label>
                    <Slider
                      value={[selectedServerData.dbdObsession]}
                      onValueChange={([value]) => handleBehaviorUpdate('dbdObsession', value)}
                      max={100}
                      step={1}
                      className="mt-2"
                      data-testid="slider-dbd-obsession"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      👨‍👩‍👧‍👦 Family Business Mode ({selectedServerData.familyBusinessMode}%)
                    </label>
                    <Slider
                      value={[selectedServerData.familyBusinessMode]}
                      onValueChange={([value]) => handleBehaviorUpdate('familyBusinessMode', value)}
                      max={100}
                      step={1}
                      className="mt-2"
                      data-testid="slider-family-business"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Server Members */}
          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Server Members ({serverMembers.length})</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Members Nicky has interacted with
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {serverMembers.map((member) => (
                      <Card key={member.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{member.username}</h4>
                            {member.nickname && (
                              <p className="text-sm text-muted-foreground">
                                aka {member.nickname}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {member.interactionCount} interactions
                            </p>
                            {member.facts.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium">Facts:</p>
                                <ul className="text-xs text-muted-foreground list-disc list-inside">
                                  {member.facts.map((fact, i) => (
                                    <li key={i}>{fact}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {serverMembers.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No members yet. Nicky will learn about people as he interacts with them.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topic Triggers */}
          <TabsContent value="triggers" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Topic Triggers ({topicTriggers.length})</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Words and phrases that make Nicky jump into conversations
                  </p>
                </div>
                <Dialog open={showAddTriggerDialog} onOpenChange={setShowAddTriggerDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-trigger">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Trigger
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Topic Trigger</DialogTitle>
                      <DialogDescription>
                        Configure a new topic that will make Nicky respond to messages
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Topic/Keyword</label>
                        <Input
                          value={newTrigger.topic}
                          onChange={(e) => setNewTrigger(prev => ({ ...prev, topic: e.target.value }))}
                          placeholder="e.g., pasta, DBD, family"
                          data-testid="input-trigger-topic"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Priority</label>
                        <Select
                          value={newTrigger.category}
                          onValueChange={(value: 'HIGH' | 'MEDIUM' | 'LOW') => 
                            setNewTrigger(prev => ({ ...prev, category: value }))
                          }
                        >
                          <SelectTrigger data-testid="select-trigger-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HIGH">🔥 High (Always responds)</SelectItem>
                            <SelectItem value="MEDIUM">⚡ Medium (Usually responds)</SelectItem>
                            <SelectItem value="LOW">📝 Low (Sometimes responds)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Response Chance ({newTrigger.responseChance}%)
                        </label>
                        <Slider
                          value={[newTrigger.responseChance]}
                          onValueChange={([value]) => setNewTrigger(prev => ({ ...prev, responseChance: value }))}
                          max={100}
                          step={5}
                          className="mt-2"
                          data-testid="slider-response-chance"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Custom Response (Optional)</label>
                        <Textarea
                          value={newTrigger.customResponse}
                          onChange={(e) => setNewTrigger(prev => ({ ...prev, customResponse: e.target.value }))}
                          placeholder="Custom response template..."
                          data-testid="textarea-custom-response"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleAddTrigger}
                        disabled={!newTrigger.topic.trim()}
                        data-testid="button-save-trigger"
                      >
                        Add Trigger
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {topicTriggers.map((trigger) => (
                      <Card key={trigger.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{trigger.topic}</h4>
                              <Badge 
                                variant={trigger.category === 'HIGH' ? 'destructive' : 
                                        trigger.category === 'MEDIUM' ? 'default' : 'secondary'}
                              >
                                {trigger.category}
                              </Badge>
                              <Badge variant="outline">
                                {trigger.responseChance}% chance
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Triggered {trigger.triggerCount} times
                              {trigger.lastTriggered && ` • Last: ${new Date(trigger.lastTriggered).toLocaleDateString()}`}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteTriggerMutation.mutate(trigger.id)}
                            data-testid={`button-delete-trigger-${trigger.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {topicTriggers.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No topic triggers configured. Add some topics that Nicky should respond to!
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {discordServers.length === 0 && botStatus?.connected && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                Invite Nicky to a Discord server to get started!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}