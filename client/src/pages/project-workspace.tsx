import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Lightbulb, Target, CheckCircle, Clock, AlertTriangle, FileText, Users, Settings, Trash2, Edit, BookOpen, Code, Database, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProjectIdea {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'IDEA' | 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  category: 'FEATURE' | 'BUG_FIX' | 'IMPROVEMENT' | 'RESEARCH' | 'INFRASTRUCTURE';
  createdAt: string;
  updatedAt: string;
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
}

interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  completedDate?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  progress: number;
  tasks: string[];
}

interface ProjectNote {
  id: string;
  title: string;
  content: string;
  category: 'GENERAL' | 'TECHNICAL' | 'DESIGN' | 'MEETING' | 'DECISION';
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export default function ProjectWorkspace() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<string>("overview");
  const [isIdeaDialogOpen, setIsIdeaDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  
  // Mock data for now - would be connected to API later
  const [ideas, setIdeas] = useState<ProjectIdea[]>([
    {
      id: '1',
      title: 'Enhanced Voice Recognition',
      description: 'Improve the accuracy of voice recognition for better interaction with Nicky',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      category: 'FEATURE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['voice', 'ai', 'enhancement'],
      estimatedHours: 20,
      actualHours: 12
    },
    {
      id: '2',
      title: 'Memory Optimization',
      description: 'Optimize memory retrieval for better narrative coherence',
      priority: 'HIGH',
      status: 'COMPLETED',
      category: 'IMPROVEMENT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['memory', 'performance', 'narrative'],
      estimatedHours: 15,
      actualHours: 18
    }
  ]);

  const [milestones, setMilestones] = useState<ProjectMilestone[]>([
    {
      id: '1',
      title: 'AI Co-Host MVP',
      description: 'Basic functioning AI co-host with voice interaction',
      targetDate: '2024-01-15',
      completedDate: '2024-01-10',
      status: 'COMPLETED',
      progress: 100,
      tasks: ['Voice recognition', 'Basic AI responses', 'Memory system']
    },
    {
      id: '2',
      title: 'Enhanced Memory System',
      description: 'Advanced memory management with narrative coherence',
      targetDate: '2024-02-01',
      status: 'IN_PROGRESS',
      progress: 85,
      tasks: ['Story context preservation', 'Contradiction detection', 'Document reprocessing']
    }
  ]);

  const [notes, setNotes] = useState<ProjectNote[]>([
    {
      id: '1',
      title: 'Narrative Fragmentation Issue',
      content: 'Discovered that atomic fact extraction was losing story context. Implemented enhanced retrieval system to preserve parent story information.',
      category: 'TECHNICAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['memory', 'narrative', 'bug-fix']
    },
    {
      id: '2',
      title: 'ElevenLabs Integration',
      content: 'Successfully integrated ElevenLabs for improved voice synthesis. Settings: stability 0.3, similarity_boost 0.75, style 0',
      category: 'TECHNICAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['voice', 'integration', 'elevenlabs']
    }
  ]);

  const [newIdea, setNewIdea] = useState<Partial<ProjectIdea>>({
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'IDEA',
    category: 'FEATURE',
    tags: []
  });

  const [newNote, setNewNote] = useState<Partial<ProjectNote>>({
    title: '',
    content: '',
    category: 'GENERAL',
    tags: []
  });

  const [newMilestone, setNewMilestone] = useState<Partial<ProjectMilestone>>({
    title: '',
    description: '',
    targetDate: '',
    status: 'NOT_STARTED',
    progress: 0,
    tasks: []
  });

  const addIdea = () => {
    if (!newIdea.title || !newIdea.description) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and description for the idea.",
        variant: "destructive",
      });
      return;
    }

    const idea: ProjectIdea = {
      id: Date.now().toString(),
      title: newIdea.title!,
      description: newIdea.description!,
      priority: newIdea.priority as ProjectIdea['priority'],
      status: newIdea.status as ProjectIdea['status'],
      category: newIdea.category as ProjectIdea['category'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: Array.isArray(newIdea.tags) ? newIdea.tags : [],
      estimatedHours: newIdea.estimatedHours,
      actualHours: newIdea.actualHours
    };

    setIdeas([...ideas, idea]);
    setNewIdea({
      title: '',
      description: '',
      priority: 'MEDIUM',
      status: 'IDEA',
      category: 'FEATURE',
      tags: []
    });
    setIsIdeaDialogOpen(false);

    toast({
      title: "Idea Added",
      description: "Your project idea has been added successfully!",
    });
  };

  const addNote = () => {
    if (!newNote.title || !newNote.content) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and content for the note.",
        variant: "destructive",
      });
      return;
    }

    const note: ProjectNote = {
      id: Date.now().toString(),
      title: newNote.title!,
      content: newNote.content!,
      category: newNote.category as ProjectNote['category'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: Array.isArray(newNote.tags) ? newNote.tags : []
    };

    setNotes([...notes, note]);
    setNewNote({
      title: '',
      content: '',
      category: 'GENERAL',
      tags: []
    });
    setIsNoteDialogOpen(false);

    toast({
      title: "Note Added",
      description: "Your project note has been saved successfully!",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'ON_HOLD': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'PLANNING': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FEATURE': return <Zap className="w-4 h-4" />;
      case 'BUG_FIX': return <AlertTriangle className="w-4 h-4" />;
      case 'IMPROVEMENT': return <Target className="w-4 h-4" />;
      case 'RESEARCH': return <BookOpen className="w-4 h-4" />;
      case 'INFRASTRUCTURE': return <Database className="w-4 h-4" />;
      default: return <Code className="w-4 h-4" />;
    }
  };

  const completedIdeas = ideas.filter(idea => idea.status === 'COMPLETED').length;
  const inProgressIdeas = ideas.filter(idea => idea.status === 'IN_PROGRESS').length;
  const totalEstimatedHours = ideas.reduce((sum, idea) => sum + (idea.estimatedHours || 0), 0);
  const totalActualHours = ideas.reduce((sum, idea) => sum + (idea.actualHours || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <Link href="/brain">
              <Button variant="ghost" size="sm" data-testid="button-brain-management">
                <Users className="w-4 h-4 mr-2" />
                Brain Management
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Project Workspace</h1>
              <p className="text-gray-600 dark:text-gray-300">Organize ideas, track progress, and manage your AI co-host development</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isIdeaDialogOpen} onOpenChange={setIsIdeaDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600" data-testid="button-add-idea">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Idea
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Project Idea</DialogTitle>
                    <DialogDescription>
                      Capture your ideas and track their development progress
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <Input
                      placeholder="Idea title..."
                      value={newIdea.title}
                      onChange={(e) => setNewIdea({...newIdea, title: e.target.value})}
                      data-testid="input-idea-title"
                    />
                    
                    <Textarea
                      placeholder="Describe your idea in detail..."
                      value={newIdea.description}
                      onChange={(e) => setNewIdea({...newIdea, description: e.target.value})}
                      rows={4}
                      data-testid="textarea-idea-description"
                    />
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Priority</label>
                        <Select value={newIdea.priority} onValueChange={(value) => setNewIdea({...newIdea, priority: value as ProjectIdea['priority']})}>
                          <SelectTrigger data-testid="select-idea-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HIGH">🔴 High</SelectItem>
                            <SelectItem value="MEDIUM">🟡 Medium</SelectItem>
                            <SelectItem value="LOW">🟢 Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Category</label>
                        <Select value={newIdea.category} onValueChange={(value) => setNewIdea({...newIdea, category: value as ProjectIdea['category']})}>
                          <SelectTrigger data-testid="select-idea-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FEATURE">⚡ Feature</SelectItem>
                            <SelectItem value="IMPROVEMENT">🎯 Improvement</SelectItem>
                            <SelectItem value="BUG_FIX">🐛 Bug Fix</SelectItem>
                            <SelectItem value="RESEARCH">📚 Research</SelectItem>
                            <SelectItem value="INFRASTRUCTURE">🗄️ Infrastructure</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Estimated Hours</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={newIdea.estimatedHours || ''}
                          onChange={(e) => setNewIdea({...newIdea, estimatedHours: e.target.value ? parseInt(e.target.value) : undefined})}
                          data-testid="input-idea-hours"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsIdeaDialogOpen(false)} data-testid="button-cancel-idea">
                      Cancel
                    </Button>
                    <Button onClick={addIdea} data-testid="button-save-idea">Add Idea</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-note">
                    <FileText className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Project Note</DialogTitle>
                    <DialogDescription>
                      Keep track of important insights, decisions, and progress updates
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <Input
                      placeholder="Note title..."
                      value={newNote.title}
                      onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                      data-testid="input-note-title"
                    />
                    
                    <Textarea
                      placeholder="Write your note content here..."
                      value={newNote.content}
                      onChange={(e) => setNewNote({...newNote, content: e.target.value})}
                      rows={6}
                      data-testid="textarea-note-content"
                    />
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select value={newNote.category} onValueChange={(value) => setNewNote({...newNote, category: value as ProjectNote['category']})}>
                        <SelectTrigger data-testid="select-note-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GENERAL">📝 General</SelectItem>
                          <SelectItem value="TECHNICAL">⚙️ Technical</SelectItem>
                          <SelectItem value="DESIGN">🎨 Design</SelectItem>
                          <SelectItem value="MEETING">👥 Meeting</SelectItem>
                          <SelectItem value="DECISION">⚖️ Decision</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)} data-testid="button-cancel-note">
                      Cancel
                    </Button>
                    <Button onClick={addNote} data-testid="button-save-note">Add Note</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              📊 Overview
            </TabsTrigger>
            <TabsTrigger value="ideas" data-testid="tab-ideas">
              💡 Ideas & Tasks ({ideas.length})
            </TabsTrigger>
            <TabsTrigger value="milestones" data-testid="tab-milestones">
              🎯 Milestones ({milestones.length})
            </TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">
              📝 Notes ({notes.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Stats Cards */}
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Ideas</CardTitle>
                  <div className="text-2xl font-bold">{ideas.length}</div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {inProgressIdeas} in progress
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Completed</CardTitle>
                  <div className="text-2xl font-bold">{completedIdeas}</div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((completedIdeas / ideas.length) * 100)}% completion rate
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400">Estimated Hours</CardTitle>
                  <div className="text-2xl font-bold">{totalEstimatedHours}h</div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {totalActualHours}h actual
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">Project Notes</CardTitle>
                  <div className="text-2xl font-bold">{notes.length}</div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Knowledge base
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity & Milestones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Ideas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {ideas.slice(0, 5).map((idea) => (
                        <div key={idea.id} className="flex items-start gap-3 p-3 border rounded-lg">
                          <div className="mt-1">{getCategoryIcon(idea.category)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{idea.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{idea.description}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge className={`text-xs ${getStatusColor(idea.status)}`}>
                                {idea.status.replace('_', ' ')}
                              </Badge>
                              <Badge className={`text-xs ${getPriorityColor(idea.priority)}`}>
                                {idea.priority}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Milestone Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      {milestones.map((milestone) => (
                        <div key={milestone.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{milestone.title}</p>
                            <Badge className={`text-xs ${getStatusColor(milestone.status)}`}>
                              {milestone.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <Progress value={milestone.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {milestone.progress}% complete
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Ideas Tab */}
          <TabsContent value="ideas" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Project Ideas & Tasks</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="IDEA">Ideas</SelectItem>
                        <SelectItem value="PLANNING">Planning</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="ON_HOLD">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {ideas.map((idea) => (
                      <Card key={idea.id} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="mt-1">{getCategoryIcon(idea.category)}</div>
                              <div>
                                <CardTitle className="text-base">{idea.title}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">{idea.description}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" data-testid={`button-edit-idea-${idea.id}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`button-delete-idea-${idea.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={getStatusColor(idea.status)}>
                              {idea.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={getPriorityColor(idea.priority)}>
                              {idea.priority}
                            </Badge>
                            <Badge variant="outline">
                              {idea.category.replace('_', ' ')}
                            </Badge>
                            {idea.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          
                          {(idea.estimatedHours || idea.actualHours) && (
                            <div className="text-sm text-muted-foreground">
                              {idea.estimatedHours && `Est: ${idea.estimatedHours}h`}
                              {idea.actualHours && ` | Actual: ${idea.actualHours}h`}
                            </div>
                          )}
                          
                          <div className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(idea.createdAt).toLocaleDateString()}
                            {idea.updatedAt !== idea.createdAt && 
                              ` | Updated: ${new Date(idea.updatedAt).toLocaleDateString()}`
                            }
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Milestones Tab */}
          <TabsContent value="milestones" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Project Milestones</CardTitle>
                  <Button data-testid="button-add-milestone">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Milestone
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id} className="relative">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            milestone.status === 'COMPLETED' 
                              ? 'bg-green-500 text-white' 
                              : milestone.status === 'IN_PROGRESS'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          }`}>
                            {milestone.status === 'COMPLETED' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </div>
                          {index < milestones.length - 1 && (
                            <div className="absolute top-8 left-4 w-px h-16 bg-border transform -translate-x-1/2" />
                          )}
                        </div>
                        
                        <Card className="flex-1">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{milestone.title}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                              </div>
                              <Badge className={getStatusColor(milestone.status)}>
                                {milestone.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <div className="flex items-center justify-between text-sm mb-2">
                                  <span>Progress</span>
                                  <span>{milestone.progress}%</span>
                                </div>
                                <Progress value={milestone.progress} />
                              </div>
                              
                              <div className="flex items-center justify-between text-sm">
                                <span>Target Date:</span>
                                <span>{new Date(milestone.targetDate).toLocaleDateString()}</span>
                              </div>
                              
                              {milestone.completedDate && (
                                <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
                                  <span>Completed:</span>
                                  <span>{new Date(milestone.completedDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              
                              {milestone.tasks.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium mb-2">Tasks:</p>
                                  <ul className="text-sm space-y-1">
                                    {milestone.tasks.map((task, taskIndex) => (
                                      <li key={taskIndex} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                                        {task}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Project Notes</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="TECHNICAL">Technical</SelectItem>
                        <SelectItem value="DESIGN">Design</SelectItem>
                        <SelectItem value="MEETING">Meeting</SelectItem>
                        <SelectItem value="DECISION">Decision</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {notes.map((note) => (
                      <Card key={note.id} className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{note.title}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary">
                                  {note.category.replace('_', ' ')}
                                </Badge>
                                {note.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" data-testid={`button-edit-note-${note.id}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`button-delete-note-${note.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                          <div className="text-xs text-muted-foreground mt-3">
                            Created: {new Date(note.createdAt).toLocaleDateString()}
                            {note.updatedAt !== note.createdAt && 
                              ` | Updated: ${new Date(note.updatedAt).toLocaleDateString()}`
                            }
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}