import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AIModel, MODEL_METADATA, getModelPreference, setModelPreference } from "@shared/modelSelection";
import { useState, useEffect } from "react";
import { Zap, Brain, Sparkles, Rabbit } from "lucide-react";

interface QuickModelToggleProps {
  className?: string;
  compact?: boolean;
}

export function QuickModelToggle({ className, compact = false }: QuickModelToggleProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel>(
    getModelPreference('chat')
  );

  const handleModelChange = (model: string) => {
    const aiModel = model as AIModel;
    setSelectedModel(aiModel);
    setModelPreference('chat', aiModel);
  };

  const getModelIcon = (model: AIModel) => {
    switch (model) {
      case 'claude-sonnet-4.5':
        return <Brain className="h-4 w-4" />;
      case 'gemini-3-pro-preview':
        return <Sparkles className="h-4 w-4" />;
      case 'gemini-3-flash-preview':
        return <Zap className="h-4 w-4" />;
      case 'gemini-2.5-pro':
        return <Zap className="h-4 w-4 opacity-50" />;
      case 'gemini-2.5-flash':
        return <Rabbit className="h-4 w-4" />;
    }
  };

  const getShortName = (model: AIModel) => {
    switch (model) {
      case 'claude-sonnet-4.5':
        return 'Claude 4.5';
      case 'gemini-3-pro-preview':
        return 'Gemini 3 Pro';
      case 'gemini-3-flash-preview':
        return 'Gemini 3 Flash';
      case 'gemini-2.5-pro':
        return 'Gemini 2.5 (Legacy)';
      case 'gemini-2.5-flash':
        return 'Gemini Flash';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-muted-foreground">Model:</span>
        <Select value={selectedModel} onValueChange={handleModelChange}>
          <SelectTrigger className="h-8 w-[140px]">
            <div className="flex items-center gap-1">
              {getModelIcon(selectedModel)}
              <span className="text-xs">{getShortName(selectedModel)}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODEL_METADATA) as AIModel[]).map((model) => {
              const metadata = MODEL_METADATA[model];
              return (
                <SelectItem key={model} value={model}>
                  <div className="flex items-center gap-2">
                    {getModelIcon(model)}
                    <span className="text-sm">{getShortName(model)}</span>
                    {metadata.costLevel === 'cheap' && (
                      <Badge variant="outline" className="ml-auto bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
                        💰
                      </Badge>
                    )}
                    {metadata.quality === 'premium' && (
                      <Badge variant="outline" className="ml-auto bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs">
                        ⭐
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Chat AI Model</label>
        <Badge variant="outline" className="text-xs">
          {MODEL_METADATA[selectedModel].costLevel === 'cheap' && '💰 Cheap'}
          {MODEL_METADATA[selectedModel].costLevel === 'moderate' && '💵 Moderate'}
          {MODEL_METADATA[selectedModel].costLevel === 'expensive' && '💎 Premium'}
        </Badge>
      </div>

      <Select value={selectedModel} onValueChange={handleModelChange}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {getModelIcon(selectedModel)}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODEL_METADATA) as AIModel[]).map((model) => {
            const metadata = MODEL_METADATA[model];
            return (
              <SelectItem key={model} value={model}>
                <div className="flex items-center gap-2 w-full">
                  {getModelIcon(model)}
                  <span>{metadata.displayName}</span>
                  {metadata.quality === 'premium' && (
                    <Badge variant="outline" className="ml-auto bg-purple-500/20 text-purple-700 dark:text-purple-400">
                      ⭐
                    </Badge>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">
        {MODEL_METADATA[selectedModel].description}
      </p>
    </div>
  );
}
