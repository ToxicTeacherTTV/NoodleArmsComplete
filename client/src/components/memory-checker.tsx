import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface MemoryResult {
  id: string;
  type: string;
  content: string;
  importance: number;
  retrievalCount: number;
  createdAt: string;
}

interface MemoryCheckResult {
  query: string;
  count: number;
  memories: MemoryResult[];
}

interface MemoryCheckerProps {
  selectedText: string;
  profileId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export function MemoryChecker({ selectedText, profileId, isOpen, onClose, position }: MemoryCheckerProps) {
  const [searchQuery, setSearchQuery] = useState(selectedText);

  const { data: memoryData, isLoading } = useQuery<MemoryCheckResult>({
    queryKey: ['/api/memory/search', profileId, searchQuery],
    queryFn: async () => {
      if (!profileId || !searchQuery.trim()) return { query: '', count: 0, memories: [] };
      
      const response = await fetch(`/api/memory/search/${profileId}?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Memory search failed');
      return response.json();
    },
    enabled: isOpen && !!profileId && !!searchQuery.trim(),
  });

  const getVerificationStatus = () => {
    if (!memoryData) return { status: 'loading', message: 'Checking memory...', color: 'gray' };
    
    if (memoryData.count === 0) {
      return { 
        status: 'not-found', 
        message: `No memories found for "${searchQuery}"`, 
        color: 'red' 
      };
    }
    
    if (memoryData.count > 0) {
      return { 
        status: 'verified', 
        message: `${memoryData.count} memories found`, 
        color: 'green' 
      };
    }
    
    return { status: 'unknown', message: 'Unknown status', color: 'gray' };
  };

  const verification = getVerificationStatus();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[80vh]"
        style={{
          position: 'fixed',
          top: Math.min(position.y, window.innerHeight - 400),
          left: Math.min(position.x, window.innerWidth - 600),
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Memory Verification
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Query */}
          <div className="p-3 bg-secondary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">Checking:</span>
              <Badge variant="outline" className="font-mono">
                "{selectedText}"
              </Badge>
            </div>
            
            {/* Verification Status */}
            <div className="flex items-center gap-2">
              {verification.status === 'loading' && (
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              )}
              {verification.status === 'verified' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {verification.status === 'not-found' && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${
                verification.color === 'green' ? 'text-green-600' : 
                verification.color === 'red' ? 'text-red-600' : 
                'text-muted-foreground'
              }`}>
                {verification.message}
              </span>
            </div>
          </div>

          {/* Memory Results */}
          {memoryData && memoryData.memories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Actual Memories:</h3>
              <ScrollArea className="h-64 border rounded-lg p-3">
                <div className="space-y-3">
                  {memoryData.memories.slice(0, 10).map((memory) => (
                    <div key={memory.id} className="p-3 bg-secondary/10 rounded border">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {memory.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Importance: {memory.importance}/5
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">
                        {memory.content}
                      </p>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(memory.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* No Results */}
          {memoryData && memoryData.count === 0 && (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Memories Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This might be a hallucination or made-up detail!
              </p>
              <Badge variant="destructive" className="text-xs">
                🚨 Potential AI Hallucination
              </Badge>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}