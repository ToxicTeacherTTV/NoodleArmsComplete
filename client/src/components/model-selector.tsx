import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AIModel, AIOperation, MODEL_METADATA, getModelPreference, setModelPreference } from "@shared/modelSelection";
import { useState, useEffect } from "react";

interface ModelSelectorProps {
  operation: AIOperation;
  value?: AIModel;
  onChange?: (model: AIModel) => void;
  showCostInfo?: boolean;
  className?: string;
}

export function ModelSelector({ 
  operation, 
  value, 
  onChange, 
  showCostInfo = true,
  className 
}: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel>(
    value || getModelPreference(operation)
  );

  useEffect(() => {
    if (value) {
      setSelectedModel(value);
    }
  }, [value]);

  const handleModelChange = (model: string) => {
    const aiModel = model as AIModel;
    setSelectedModel(aiModel);
    setModelPreference(operation, aiModel);
    onChange?.(aiModel);
  };

  const getOperationLabel = (op: AIOperation): string => {
    const labels: Record<AIOperation, string> = {
      'chat': 'Chat Responses',
      'document-processing': 'Document Processing',
      'podcast-training': 'Podcast Training',
      'memory-consolidation': 'Memory Consolidation',
      'fact-extraction': 'Fact Extraction',
      'style-analysis': 'Style Analysis'
    };
    return labels[op];
  };

  const getCostBadge = (model: AIModel) => {
    const metadata = MODEL_METADATA[model];
    const costColors = {
      'cheap': 'bg-green-500/20 text-green-700 dark:text-green-400',
      'moderate': 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
      'expensive': 'bg-red-500/20 text-red-700 dark:text-red-400'
    };
    
    return (
      <Badge variant="outline" className={`ml-2 ${costColors[metadata.costLevel]}`}>
        {metadata.costLevel === 'cheap' && '💰 Cheap'}
        {metadata.costLevel === 'moderate' && '💵 Moderate'}
        {metadata.costLevel === 'expensive' && '💎 Premium'}
      </Badge>
    );
  };

  const getQualityBadge = (model: AIModel) => {
    const metadata = MODEL_METADATA[model];
    if (metadata.quality === 'premium') {
      return <Badge variant="outline" className="ml-2 bg-purple-500/20 text-purple-700 dark:text-purple-400">⭐ Premium</Badge>;
    }
    return null;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">
          AI Model for {getOperationLabel(operation)}
        </label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                Choose the AI model for this operation. Higher quality models provide better results but cost more.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Select value={selectedModel} onValueChange={handleModelChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODEL_METADATA) as AIModel[]).map((model) => {
            const metadata = MODEL_METADATA[model];
            return (
              <SelectItem key={model} value={model}>
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">{metadata.displayName}</span>
                  <div className="flex items-center">
                    {showCostInfo && getCostBadge(model)}
                    {getQualityBadge(model)}
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {showCostInfo && (
        <p className="text-xs text-muted-foreground">
          {MODEL_METADATA[selectedModel].description}
        </p>
      )}
    </div>
  );
}
