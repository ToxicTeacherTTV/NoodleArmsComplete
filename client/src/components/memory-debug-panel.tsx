import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bug, ChevronDown, ChevronUp, Brain, Search } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RetrievedMemory {
  id: string;
  content: string;
  type: string;
  importance: number;
  relevanceScore?: number;
  source?: string;
  keywords?: string[];
}

interface MemoryDebugInfo {
  query: string;
  timestamp: string;
  memoriesRetrieved: RetrievedMemory[];
  retrievalMethod: string;
  executionTime?: number;
}

interface MemoryDebugPanelProps {
  debugEnabled: boolean;
  onDebugToggle: (enabled: boolean) => void;
  debugHistory: MemoryDebugInfo[];
}

export function MemoryDebugPanel({ 
  debugEnabled, 
  onDebugToggle, 
  debugHistory 
}: MemoryDebugPanelProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FACT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'PREFERENCE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'LORE':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'CONTEXT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <Card className="w-full border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="w-5 h-5 text-orange-600" />
            Memory Debug Mode
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {debugEnabled ? 'ON' : 'OFF'}
            </span>
            <Switch
              checked={debugEnabled}
              onCheckedChange={onDebugToggle}
              data-testid="toggle-debug-mode"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Track which memories are retrieved for each response to troubleshoot memory retrieval
        </p>
      </CardHeader>
      
      {debugEnabled && (
        <CardContent className="pt-0">
          {debugHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No debug data yet</p>
              <p className="text-xs">Send a message to see memory retrieval</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {debugHistory.map((item, index) => (
                  <Collapsible
                    key={index}
                    open={expandedItems.has(index)}
                    onOpenChange={() => toggleItem(index)}
                  >
                    <Card className="border-l-4 border-l-orange-500">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Search className="w-4 h-4 text-orange-600 flex-shrink-0" />
                            <div className="text-left min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {item.query || 'No query'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {item.memoriesRetrieved.length} memories
                                </Badge>
                                {item.executionTime && (
                                  <span className="text-xs text-muted-foreground">
                                    {item.executionTime}ms
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {expandedItems.has(index) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="px-3 pb-3 space-y-2 border-t pt-3">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-muted-foreground">Retrieval Method:</span>
                            <Badge variant="outline" className="text-xs">
                              {item.retrievalMethod}
                            </Badge>
                          </div>
                          
                          {item.memoriesRetrieved.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              No memories retrieved
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {item.memoriesRetrieved.map((memory, memIdx) => (
                                <div
                                  key={memory.id || memIdx}
                                  className="p-2 bg-muted/50 rounded border text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge className={getTypeColor(memory.type)}>
                                      {memory.type}
                                    </Badge>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">
                                        Importance: {memory.importance}/5
                                      </span>
                                      {memory.relevanceScore !== undefined && (
                                        <Badge variant="secondary" className="text-xs">
                                          Score: {memory.relevanceScore}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-foreground leading-relaxed">
                                    {memory.content}
                                  </p>
                                  {memory.keywords && memory.keywords.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-1">
                                      {memory.keywords.slice(0, 5).map((keyword, kidx) => (
                                        <Badge key={kidx} variant="outline" className="text-xs py-0">
                                          {keyword}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {memory.source && (
                                    <div className="text-muted-foreground mt-1">
                                      Source: {memory.source}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {debugHistory.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/20 p-3 rounded">
              <strong>💡 Debug Tip:</strong> Check if the right memories are being retrieved. 
              If important memories are missing, they might need better keywords or higher importance scores.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
