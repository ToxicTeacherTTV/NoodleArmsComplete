import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, FileText, X } from "lucide-react";

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotesModal({ isOpen, onClose }: NotesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Fetch notes content
  const { data: notesData, isLoading } = useQuery({
    queryKey: ['/api/notes'],
    enabled: isOpen,
  });

  // Save notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('/api/notes', {
        method: 'PUT',
        body: { content },
      });
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      toast({
        title: "Notes saved",
        description: "Your notes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save failed", 
        description: "Failed to save notes. Please try again.",
        variant: "destructive",
      });
      console.error('Save notes error:', error);
    },
  });

  // Initialize content when modal opens and data loads
  useEffect(() => {
    if (notesData?.content && isOpen) {
      setContent(notesData.content);
      setIsDirty(false);
    }
  }, [notesData, isOpen]);

  // Handle content changes
  const handleContentChange = (value: string) => {
    setContent(value);
    setIsDirty(value !== (notesData?.content || ""));
  };

  // Handle save
  const handleSave = () => {
    saveNotesMutation.mutate(content);
  };

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (isDirty) {
      const shouldClose = window.confirm(
        "You have unsaved changes. Are you sure you want to close without saving?"
      );
      if (!shouldClose) return;
    }
    setIsDirty(false);
    onClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Ctrl+S or Cmd+S to save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
      
      // Escape to close
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, content]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col" data-testid="modal-notes">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Development Notes
            {isDirty && <span className="text-orange-500 text-sm">(unsaved)</span>}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse">Loading notes...</div>
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Add your development notes here..."
              className="h-full min-h-[400px] resize-none font-mono text-sm"
              data-testid="textarea-notes"
            />
          )}
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          <div className="flex items-center justify-between">
            <span>
              Use HTML comments &lt;!-- like this --&gt; to hide text from rendering
            </span>
            <span>
              Shortcuts: Ctrl+S (save), Esc (close)
            </span>
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-close-notes"
          >
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveNotesMutation.isPending}
            data-testid="button-save-notes"
          >
            <Save className="h-4 w-4 mr-1" />
            {saveNotesMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}