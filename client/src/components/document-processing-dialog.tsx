import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";
import { ModelSelector } from "./model-selector";
import { AIModel, getModelPreference } from "@shared/modelSelection";
import { useState } from "react";

interface DocumentProcessingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  operation: 'extract-facts' | 'reprocess';
  onConfirm: (selectedModel: AIModel) => void;
  isProcessing?: boolean;
}

export function DocumentProcessingDialog({
  open,
  onOpenChange,
  documentName,
  operation,
  onConfirm,
  isProcessing = false
}: DocumentProcessingDialogProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel>(
    getModelPreference('document-processing')
  );

  const operationLabels = {
    'extract-facts': 'Extract Facts',
    'reprocess': 'Reprocess Document'
  };

  const operationDescriptions = {
    'extract-facts': 'This will analyze the document and extract facts into Nicky\'s memory system.',
    'reprocess': 'This will reprocess the document with enhanced AI chunking and entity extraction.'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {operationLabels[operation]}
          </DialogTitle>
          <DialogDescription>
            {operationDescriptions[operation]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Processing: <strong>{documentName}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <ModelSelector 
              operation="document-processing"
              value={selectedModel}
              onChange={setSelectedModel}
              showCostInfo={true}
            />
          </div>

          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertDescription className="text-sm">
              💡 <strong>Tip:</strong> Use <strong>Claude 4.5</strong> or <strong>Gemini 3</strong> for highest quality, 
              or <strong>Gemini Flash</strong> for faster processing of large documents.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(selectedModel);
              onOpenChange(false);
            }}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : `Process with ${selectedModel.includes('claude') ? 'Claude' : 'Gemini'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
