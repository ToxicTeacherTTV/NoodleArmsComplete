import { AlertTriangle, Clock, CheckCircle, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { IntelligenceAnalysis } from './types';

interface IntelligenceSummaryStatsProps {
    analysis?: IntelligenceAnalysis;
}

export const IntelligenceSummaryStats = ({ analysis }: IntelligenceSummaryStatsProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <div>
                            <div className="text-2xl font-bold text-red-600" data-testid="high-priority-count">
                                {analysis?.summary?.highPriority || analysis?.actionRequired || 0}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                High Priority
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                        <Clock className="h-5 w-5 text-yellow-600" />
                        <div>
                            <div className="text-2xl font-bold text-yellow-600" data-testid="medium-priority-count">
                                {analysis?.summary?.mediumPriority || 0}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Medium Priority
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                            <div className="text-2xl font-bold text-green-600" data-testid="auto-handled-count">
                                {analysis?.summary?.autoHandled || analysis?.autoHandled || 0}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Auto-Handled
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-blue-600" />
                        <div>
                            <div className="text-2xl font-bold text-blue-600" data-testid="total-issues-count">
                                {analysis?.summary?.totalIssues || 0}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Total Issues
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
