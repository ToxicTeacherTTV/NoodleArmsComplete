import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, TrendingUp, Brain, Eye, Calendar } from 'lucide-react';
import type { MemoryEntry } from '@/types';

interface MemoryAnalyticsProps {
  profileId?: string;
}

export function MemoryAnalytics({ profileId }: MemoryAnalyticsProps) {
  const { data: memoryEntries = [], isLoading } = useQuery({
    queryKey: ['/api/memory/entries', { limit: 10000 }],
    queryFn: async () => {
      const response = await fetch('/api/memory/entries?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch memory entries');
      return response.json();
    },
    enabled: !!profileId,
  });

  // Calculate analytics
  const analytics = {
    byCategory: {
      FACT: 0,
      PREFERENCE: 0,
      LORE: 0,
      CONTEXT: 0,
    },
    byImportance: {
      '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0,
    },
    bySource: {
      conversation: 0,
      web_search: 0,
      document: 0,
      other: 0,
    },
    totalRetrievals: 0,
    avgImportance: 0,
    mostUsed: [] as MemoryEntry[],
    recentGrowth: [] as { date: string; count: number }[],
  };

  if (Array.isArray(memoryEntries) && memoryEntries.length > 0) {
    const memories = memoryEntries as MemoryEntry[];
    
    // Calculate category distribution
    memories.forEach((m) => {
      if (m.type in analytics.byCategory) {
        analytics.byCategory[m.type as keyof typeof analytics.byCategory]++;
      }
      
      const importance = Math.min(5, Math.max(0, m.importance || 0)).toString();
      if (importance in analytics.byImportance) {
        analytics.byImportance[importance as keyof typeof analytics.byImportance]++;
      }
      
      if (m.source?.startsWith('web_search')) {
        analytics.bySource.web_search++;
      } else if (m.source?.startsWith('document:')) {
        analytics.bySource.document++;
      } else if (!m.source || m.source === 'conversation') {
        analytics.bySource.conversation++;
      } else {
        analytics.bySource.other++;
      }
      
      analytics.totalRetrievals += m.retrievalCount || 0;
    });
    
    // Calculate average importance
    const totalImportance = memories.reduce((sum, m) => sum + (m.importance || 0), 0);
    analytics.avgImportance = memories.length > 0 ? totalImportance / memories.length : 0;
    
    // Get most used memories
    analytics.mostUsed = [...memories]
      .filter(m => m.retrievalCount && m.retrievalCount > 0)
      .sort((a, b) => (b.retrievalCount || 0) - (a.retrievalCount || 0))
      .slice(0, 5);
    
    // Calculate growth over last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });
    
    analytics.recentGrowth = last7Days.map(date => ({
      date,
      count: memories.filter(m => 
        new Date(m.createdAt).toISOString().split('T')[0] === date
      ).length
    }));
  }

  const maxCategoryCount = Math.max(...Object.values(analytics.byCategory));
  const maxImportanceCount = Math.max(...Object.values(analytics.byImportance));
  const maxSourceCount = Math.max(...Object.values(analytics.bySource));
  const maxGrowthCount = Math.max(...analytics.recentGrowth.map(d => d.count), 1);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="w-5 h-5" />
            Memory Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            Loading analytics...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="w-5 h-5" />
          Memory Analytics
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Insights and trends from {memoryEntries.length} stored memories
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Distribution */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-sm">Memory Types</h4>
          </div>
          <div className="space-y-2">
            {Object.entries(analytics.byCategory).map(([category, count]) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{category}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${maxCategoryCount > 0 ? (count / maxCategoryCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Importance Distribution */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-sm">Importance Levels</h4>
          </div>
          <div className="flex items-end justify-between gap-1 h-24">
            {Object.entries(analytics.byImportance).map(([level, count]) => {
              const percentage = maxImportanceCount > 0 ? (count / maxImportanceCount) * 100 : 0;
              return (
                <div key={level} className="flex-1 flex flex-col items-center gap-1">
                  <div className="relative flex-1 w-full flex items-end justify-center">
                    <div
                      className="w-full bg-accent rounded-t transition-all"
                      style={{ height: `${percentage}%`, minHeight: count > 0 ? '4px' : '0' }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium">{count}</div>
                    <div className="text-xs text-muted-foreground">{level}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-2">
            <Badge variant="secondary" className="text-xs">
              Avg: {analytics.avgImportance.toFixed(1)}/5
            </Badge>
          </div>
        </div>

        {/* Source Distribution */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-sm">Memory Sources</h4>
          </div>
          <div className="space-y-2">
            {Object.entries(analytics.bySource)
              .filter(([_, count]) => count > 0)
              .map(([source, count]) => (
                <div key={source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {source === 'web_search' ? '🌐 Web Search' :
                       source === 'conversation' ? '💬 Conversation' :
                       source === 'document' ? '📄 Document' : source}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all"
                      style={{ width: `${maxSourceCount > 0 ? (count / maxSourceCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* 7-Day Growth */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-sm">Last 7 Days</h4>
          </div>
          <div className="flex items-end justify-between gap-1 h-16">
            {analytics.recentGrowth.map((day, idx) => {
              const percentage = (day.count / maxGrowthCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="relative flex-1 w-full flex items-end justify-center">
                    <div
                      className="w-full bg-green-500/50 rounded-t transition-all"
                      style={{ height: `${percentage}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-2">
            <span className="text-xs text-muted-foreground">
              Total this week: {analytics.recentGrowth.reduce((sum, d) => sum + d.count, 0)}
            </span>
          </div>
        </div>

        {/* Most Used Memories */}
        {analytics.mostUsed.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-3">🔥 Most Retrieved</h4>
            <div className="space-y-2">
              {analytics.mostUsed.map((memory, idx) => (
                <div
                  key={memory.id}
                  className="p-2 bg-muted/50 rounded border text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="secondary" className="text-xs">
                      #{idx + 1}
                    </Badge>
                    <span className="text-primary font-medium">
                      {memory.retrievalCount} uses
                    </span>
                  </div>
                  <p className="text-foreground leading-relaxed line-clamp-2">
                    {memory.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center p-3 bg-muted/50 rounded">
            <div className="text-2xl font-bold text-primary">
              {analytics.totalRetrievals}
            </div>
            <div className="text-xs text-muted-foreground">Total Retrievals</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded">
            <div className="text-2xl font-bold text-accent">
              {memoryEntries.length}
            </div>
            <div className="text-xs text-muted-foreground">Total Memories</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
