import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, Brain, CheckCircle, XCircle, AlertTriangle, ThumbsUp, ThumbsDown, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProtectedFactsManager } from "@/components/protected-facts-manager";

interface MemoryFact {
  id: string;
  content: string;
  confidence: number;
  supportCount: number;
  importance: number;
  status: 'ACTIVE' | 'DEPRECATED' | 'AMBIGUOUS';
  source: string;
  createdAt: string;
  canonicalKey: string;
}

interface ContradictionPair {
  fact1: MemoryFact;
  fact2: MemoryFact;
  conflictReason: string;
}

export default function BrainManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("protected-facts");

  // Queries
  const { data: activeProfile } = useQuery({
    queryKey: ['/api/profiles/active'],
  });

  const { data: memoryStats } = useQuery<{totalFacts: number; conversations: number}>({
    queryKey: ['/api/memory/stats'],
  });

  const { data: highConfidenceFacts = [] } = useQuery<MemoryFact[]>({
    queryKey: ['/api/memory/high-confidence'],
  });

  const { data: contradictions = [] } = useQuery<ContradictionPair[]>({
    queryKey: ['/api/memory/contradictions'],
  });

  const { data: allFacts = [] } = useQuery<MemoryFact[]>({
    queryKey: ['/api/memory/entries'],
  });

  // Mutations
  const updateFactMutation = useMutation({
    mutationFn: async ({ factId, updates }: { factId: string; updates: any }) => {
      const response = await fetch(`/api/memory/entries/${factId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      toast({ title: "Fact updated successfully!" });
    },
  });

  const resolveContradictionMutation = useMutation({
    mutationFn: async ({ winnerFactId, loserFactId }: { winnerFactId: string; loserFactId: string }) => {
      const response = await fetch('/api/memory/resolve-contradiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerFactId, loserFactId }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      toast({ title: "Contradiction resolved!" });
    },
  });

  const boostFactMutation = useMutation({
    mutationFn: async (factId: string) => {
      const response = await fetch(`/api/memory/entries/${factId}/boost`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      toast({ title: "Fact marked as TRUE - confidence boosted to 100%!" });
    },
  });

  const deprecateFactMutation = useMutation({
    mutationFn: async (factId: string) => {
      const response = await fetch(`/api/memory/entries/${factId}/deprecate`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/memory'] });
      toast({ title: "Fact marked as FALSE - deprecated!" });
    },
  });

  const filteredFacts = (facts: MemoryFact[] = []) => {
    if (!searchQuery) return facts;
    return facts.filter(fact => 
      fact.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "bg-green-500";
    if (confidence >= 70) return "bg-blue-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return "Very High";
    if (confidence >= 70) return "High";
    if (confidence >= 60) return "Medium";
    return "Low";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-purple-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Nicky's Brain Management
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {memoryStats?.totalFacts || 0} total facts
              </div>
              <Button 
                variant="outline" 
                onClick={() => setLocation("/")}
                data-testid="button-back"
              >
                Back to Chat
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search Nicky's knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="protected-facts" data-testid="tab-protected-facts">
              Protected Facts
            </TabsTrigger>
            <TabsTrigger value="high-confidence" data-testid="tab-high-confidence">
              High Confidence Facts
            </TabsTrigger>
            <TabsTrigger value="contradictions" data-testid="tab-contradictions">
              Contradictions ({contradictions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="all-facts" data-testid="tab-all-facts">
              All Facts
            </TabsTrigger>
          </TabsList>

          {/* Protected Facts */}
          <TabsContent value="protected-facts" className="mt-6">
            <ProtectedFactsManager />
          </TabsContent>

          {/* High Confidence Facts */}
          <TabsContent value="high-confidence" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Highest Confidence Facts (90%+)</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  These are the facts Nicky relies on most - they have the highest confidence from multiple sources.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {filteredFacts(highConfidenceFacts)?.map((fact: MemoryFact) => (
                      <div
                        key={fact.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(fact.confidence)}>
                              {fact.confidence}% {getConfidenceLabel(fact.confidence)}
                            </Badge>
                            <Badge variant="outline">
                              {fact.supportCount} sources
                            </Badge>
                            <Badge variant="secondary">
                              Importance: {fact.importance}
                            </Badge>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => boostFactMutation.mutate(fact.id)}
                              data-testid={`button-boost-${fact.id}`}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              THIS IS TRUE
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deprecateFactMutation.mutate(fact.id)}
                              data-testid={`button-deprecate-${fact.id}`}
                            >
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              FALSE
                            </Button>
                          </div>
                        </div>
                        <Progress value={fact.confidence} className="w-full mb-3" />
                        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                          {fact.content}
                        </p>
                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          Source: {fact.source} • Created: {new Date(fact.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contradictions */}
          <TabsContent value="contradictions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                  Conflicting Facts
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  These facts contradict each other. Choose which one is correct or mark conflicts as "not important."
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-6">
                    {contradictions?.map((pair: ContradictionPair, index: number) => (
                      <div
                        key={index}
                        className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20"
                      >
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Contradiction: {pair.conflictReason}
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Fact 1 */}
                          <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={getConfidenceColor(pair.fact1.confidence)}>
                                {pair.fact1.confidence}% confidence
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveContradictionMutation.mutate({
                                  winnerFactId: pair.fact1.id,
                                  loserFactId: pair.fact2.id
                                })}
                                data-testid={`button-choose-${pair.fact1.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Choose This
                              </Button>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100">
                              {pair.fact1.content}
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              {pair.fact1.supportCount} sources • {pair.fact1.source}
                            </div>
                          </div>

                          {/* Fact 2 */}
                          <div className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={getConfidenceColor(pair.fact2.confidence)}>
                                {pair.fact2.confidence}% confidence
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveContradictionMutation.mutate({
                                  winnerFactId: pair.fact2.id,
                                  loserFactId: pair.fact1.id
                                })}
                                data-testid={`button-choose-${pair.fact2.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Choose This
                              </Button>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100">
                              {pair.fact2.content}
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              {pair.fact2.supportCount} sources • {pair.fact2.source}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-center">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              // Mark both as not important
                              updateFactMutation.mutate({ 
                                factId: pair.fact1.id, 
                                updates: { importance: 1 } 
                              });
                              updateFactMutation.mutate({ 
                                factId: pair.fact2.id, 
                                updates: { importance: 1 } 
                              });
                            }}
                            data-testid={`button-not-important-${index}`}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Mark as Not Important
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Facts */}
          <TabsContent value="all-facts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Facts Browser</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Browse and manage all facts in Nicky's knowledge base.
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {filteredFacts(allFacts)?.map((fact: MemoryFact) => (
                      <div
                        key={fact.id}
                        className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(fact.confidence)}>
                              {fact.confidence}%
                            </Badge>
                            <Badge variant="outline">{fact.status}</Badge>
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => boostFactMutation.mutate(fact.id)}
                              data-testid={`button-boost-all-${fact.id}`}
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deprecateFactMutation.mutate(fact.id)}
                              data-testid={`button-deprecate-all-${fact.id}`}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                          {fact.content.length > 200 
                            ? `${fact.content.substring(0, 200)}...` 
                            : fact.content
                          }
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {fact.supportCount} sources • Importance: {fact.importance} • {fact.source}
                        </div>
                      </div>
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