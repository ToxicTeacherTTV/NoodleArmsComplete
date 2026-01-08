export interface FactCluster {
    clusterId: string;
    factIds: string[];
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    consolidationScore: number;
    suggestedMerge: string;
    reasoning: string;
    facts?: { id: string; content: string }[];
}

export interface SourceReliability {
    sourceId: string;
    sourceName: string;
    reliabilityScore: number;
    recommendation: 'TRUST' | 'CAUTION' | 'DISTRUST';
    factCount: number;
    accuracyRate: number;
}

export interface PersonalityDriftItem {
    traitName: string;
    baseline: number;
    current: number;
    driftAmount: number;
    severity: 'MINOR' | 'MODERATE' | 'MAJOR';
    affectedFacts: string[];
    recommendation: string;
}

export interface ContextRelevance {
    memoryId: string;
    content: string;
    relevanceScore: number;
    shouldHide: boolean;
    reasoning: string;
}

export interface IntelligenceAnalysis {
    factClusters: FactCluster[];
    sourceReliability: SourceReliability[];
    personalityDrift: PersonalityDriftItem[];
    contextRelevance: ContextRelevance[];
    summary?: {
        totalIssues: number;
        highPriority: number;
        mediumPriority: number;
        autoHandled: number;
    };
    actionRequired?: number;
    autoHandled?: number;
    priorityActions?: string[];
}

export interface SummaryData {
    overview?: string;
    summaries?: Array<{
        id: string;
        type: string;
        title: string;
        content: string;
        priority: string;
        factCount: number;
        confidenceScore: number;
        insights?: string[];
    }>;
    insights?: string[];
    recommendations?: string[];
}
