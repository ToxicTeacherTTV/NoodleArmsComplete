import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Shield, Plus, Edit, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ProtectedFact {
  id: string;
  content: string;
  confidence: number;
  importance: number;
  keywords: string[];
  createdAt: string;
}

export function ProtectedFactsManager() {
  const [newFact, setNewFact] = useState('');
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch protected facts
  const { data: protectedFacts = [], isLoading } = useQuery({
    queryKey: ['/api/memory/protected'],
    queryFn: () => fetch('/api/memory/protected').then(res => res.json()),
  });

  // Add protected fact mutation
  const addFactMutation = useMutation({
    mutationFn: (content: string) => 
      apiRequest('POST', '/api/memory/protected', {
        content: content.trim(),
        importance: 5,
        keywords: content.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 4)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/protected'] });
      setNewFact('');
      toast({
        title: "Protected Fact Added",
        description: "Core personality trait locked in with 100% confidence",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add protected fact",
        variant: "destructive",
      });
    },
  });

  // Edit protected fact mutation
  const editFactMutation = useMutation({
    mutationFn: ({ factId, content }: { factId: string; content: string }) => 
      apiRequest('PUT', `/api/memory/entries/${factId}`, {
        content: content.trim(),
        importance: 5,
        keywords: content.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 4)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/protected'] });
      setEditingFactId(null);
      setEditingContent('');
      toast({
        title: "Protected Fact Updated",
        description: "Core personality trait updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update protected fact",
        variant: "destructive",
      });
    },
  });

  // Delete protected fact mutation
  const deleteFactMutation = useMutation({
    mutationFn: (factId: string) => 
      apiRequest('DELETE', `/api/memory/entries/${factId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory/protected'] });
      toast({
        title: "Protected Fact Removed",
        description: "Core trait removed from knowledge base",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to remove protected fact",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFact.trim()) {
      addFactMutation.mutate(newFact.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const startEditing = (fact: ProtectedFact) => {
    setEditingFactId(fact.id);
    setEditingContent(fact.content);
  };

  const cancelEditing = () => {
    setEditingFactId(null);
    setEditingContent('');
  };

  const saveEdit = () => {
    if (editingFactId && editingContent.trim()) {
      editFactMutation.mutate({ factId: editingFactId, content: editingContent.trim() });
    }
  };

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Protected Facts Manager
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Add inescapable personality traits with maximum confidence. These facts can never be contradicted.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Fact Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter a core personality fact (e.g., 'Nicky is foul-mouthed and aggressive')"
            className="flex-1"
            data-testid="input-new-protected-fact"
          />
          <Button 
            type="submit" 
            disabled={!newFact.trim() || addFactMutation.isPending}
            data-testid="button-add-protected-fact"
          >
            <Plus className="w-4 h-4 mr-1" />
            {addFactMutation.isPending ? 'Adding...' : 'Add'}
          </Button>
        </form>

        {/* Protected Facts List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Core Personality Facts ({protectedFacts.length})</h4>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              100% Confidence
            </Badge>
          </div>
          
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading protected facts...</div>
          ) : protectedFacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No protected facts yet</p>
              <p className="text-xs">Add core personality traits that can never be contradicted</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {protectedFacts.map((fact: ProtectedFact) => (
                <div
                  key={fact.id}
                  className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800"
                >
                  <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingFactId === fact.id ? (
                      // Edit mode
                      <div className="space-y-2">
                        <Input
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={handleEditKeyPress}
                          className="text-sm"
                          data-testid={`input-edit-fact-${fact.id}`}
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            disabled={!editingContent.trim() || editFactMutation.isPending}
                            data-testid={`button-save-fact-${fact.id}`}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            {editFactMutation.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={editFactMutation.isPending}
                            data-testid={`button-cancel-edit-${fact.id}`}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {fact.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {fact.confidence}% confidence
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Added {new Date(fact.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {editingFactId === fact.id ? null : (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(fact)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        data-testid={`button-edit-fact-${fact.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFactMutation.mutate(fact.id)}
                        disabled={deleteFactMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-delete-fact-${fact.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Helper Text */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <strong>💡 Tip:</strong> Protected facts get 100% confidence and can never be overridden by contradictions. 
          Use them for core personality traits, formatting rules, and essential character elements.
        </div>
      </CardContent>
    </Card>
  );
}