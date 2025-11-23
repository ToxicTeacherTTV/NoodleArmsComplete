import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelSelector } from "./model-selector";
import { AIOperation } from "@shared/modelSelection";
import { Settings } from "lucide-react";

export function AIModelSettings() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <CardTitle>AI Model Settings</CardTitle>
        </div>
        <CardDescription>
          Choose which AI models to use for different operations. Changes are saved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ModelSelector 
          operation="chat" 
          showCostInfo={true}
        />
        
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-4">High-Volume Operations</h3>
          <div className="space-y-4">
            <ModelSelector 
              operation="document-processing" 
              showCostInfo={true}
            />
            <ModelSelector 
              operation="podcast-training" 
              showCostInfo={true}
            />
            <ModelSelector 
              operation="memory-consolidation" 
              showCostInfo={true}
            />
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Use <strong>Claude Sonnet 4.5</strong> for best quality, 
            <strong> Gemini 3 Pro</strong> for Google's newest model, 
            <strong> Gemini 2.5 Pro</strong> for balance, or 
            <strong> Gemini 2.5 Flash</strong> for high-volume processing at lower cost.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
