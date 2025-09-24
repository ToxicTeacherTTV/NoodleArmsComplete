import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@/types";
import { apiRequest } from "@/lib/queryClient";

interface DocumentPanelProps {
  profileId?: string;
  documents?: Document[];
}

export default function DocumentPanel({ profileId, documents }: DocumentPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Upload Successful",
        description: `${result.filename} is being processed`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], `pasted-text-${Date.now()}.txt`, { type: 'text/plain' });
      
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Text Uploaded",
        description: `Pasted text is being processed as ${result.filename}`,
      });
      setTextInput('');
      setShowTextInput(false);
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('DELETE', `/api/documents/${documentId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "Document removed from knowledge base",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const extractAsFactsMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('POST', `/api/documents/${documentId}/extract-facts`);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Facts Extracted Successfully",
        description: `${result.factsCreated} facts added to Nicky's memory`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memory/entries'] });
    },
    onError: (error: any) => {
      toast({
        title: "Extraction Failed",
        description: error?.message || "Failed to extract facts",
        variant: "destructive",
      });
    },
  });

  const saveToContentLibraryMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('POST', `/api/documents/${documentId}/save-to-content-library`);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Saved to Content Library",
        description: `Content saved as "${result.title}" in the library`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/content-library'] });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save to content library",
        variant: "destructive",
      });
    },
  });

  const viewDocument = async (document: Document) => {
    try {
      // WORKAROUND: Direct access to document content since API is intercepted by Vite
      const content = (document as any).extractedContent || 'No content available';
      setDocumentContent(content);
      setViewingDocument(document);
    } catch (error) {
      console.error('Document view error:', error);
      toast({
        title: "Error",
        description: `Failed to view document: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }
    
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ];
    
    if (!supportedTypes.includes(file.type)) {
      toast({
        title: "Unsupported File Type",
        description: "Please select a PDF, DOCX, TXT, or MD file",
        variant: "destructive",
      });
      return;
    }
    
    uploadDocumentMutation.mutate(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleTextUpload = () => {
    if (!textInput.trim()) {
      toast({
        title: "No Text",
        description: "Please enter some text to upload",
        variant: "destructive",
      });
      return;
    }
    
    if (textInput.length < 50) {
      toast({
        title: "Text Too Short",
        description: "Please enter at least 50 characters",
        variant: "destructive",
      });
      return;
    }
    
    uploadTextMutation.mutate(textInput);
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes('pdf')) return 'fas fa-file-pdf text-destructive';
    if (contentType.includes('word')) return 'fas fa-file-word text-accent';
    if (contentType.includes('text')) return 'fas fa-file-alt text-primary';
    return 'fas fa-file text-muted-foreground';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: Document['processingStatus']) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-400';
      case 'PROCESSING': return 'text-accent';
      case 'PENDING': return 'text-yellow-400';
      case 'FAILED': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex-1 p-4 space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver 
            ? 'border-primary/50 bg-primary/10' 
            : 'border-border hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        data-testid="document-upload-area"
      >
        <i className="fas fa-cloud-upload-alt text-3xl text-muted-foreground mb-3"></i>
        <h3 className="text-sm font-medium text-foreground mb-1">Upload Documents</h3>
        <p className="text-xs text-muted-foreground mb-3">PDF, DOCX, TXT files supported</p>
        <div className="flex gap-2 mb-3">
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg text-xs transition-all duration-200"
            disabled={uploadDocumentMutation.isPending}
            data-testid="button-choose-files"
          >
            {uploadDocumentMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Uploading...
              </>
            ) : (
              'Choose Files'
            )}
          </Button>
          <Button 
            variant="outline"
            className="py-2 px-4 rounded-lg text-xs transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering file dialog
              setShowTextInput(!showTextInput);
            }}
            data-testid="button-toggle-text-input"
          >
            <i className="fas fa-paste mr-2"></i>
            Paste Text
          </Button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Text Input Area */}
      {showTextInput && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Paste Text Content</h3>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="w-full h-32 p-3 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground resize-vertical focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="Paste large amounts of text here (character information, transcripts, notes, etc.)..."
            data-testid="textarea-text-input"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {textInput.length} characters {textInput.length >= 50 ? '✓' : '(minimum 50)'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTextInput('');
                  setShowTextInput(false);
                }}
                disabled={uploadTextMutation.isPending}
                data-testid="button-cancel-text"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleTextUpload}
                disabled={uploadTextMutation.isPending || textInput.length < 50}
                data-testid="button-upload-text"
              >
                {uploadTextMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-upload mr-2"></i>
                    Upload Text
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Queue */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Document Library</h3>
        <div className="space-y-2 max-h-72 overflow-y-auto chat-scroll" data-testid="documents-list">
          {!documents || documents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <i className="fas fa-folder-open text-3xl mb-3 opacity-50"></i>
              <p>No documents uploaded</p>
              <p className="text-xs">Upload PDFs, Word docs, or text files to build Nicky's knowledge</p>
            </div>
          ) : (
            documents.map((doc) => (
              <Card key={doc.id} className="bg-card border border-border p-3 rounded-lg">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <i className={getFileIcon(doc.contentType)}></i>
                      <span className="text-sm text-foreground truncate" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`text-xs ${getStatusColor(doc.processingStatus)}`}>
                        {doc.processingStatus.charAt(0) + doc.processingStatus.slice(1).toLowerCase()}
                        {doc.processingStatus === 'PROCESSING' && (
                          <i className="fas fa-spinner fa-spin ml-1"></i>
                        )}
                      </div>
                      <Button
                        onClick={() => viewDocument(doc)}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-primary p-1"
                        disabled={doc.processingStatus !== 'COMPLETED'}
                        data-testid={`button-view-document-${doc.id}`}
                      >
                        <i className="fas fa-eye"></i>
                      </Button>
                      <Button
                        onClick={() => deleteDocumentMutation.mutate(doc.id)}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-destructive p-1"
                        data-testid={`button-delete-document-${doc.id}`}
                      >
                        <i className="fas fa-trash"></i>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Processing Choice Buttons - Only show for completed documents */}
                  {doc.processingStatus === 'COMPLETED' && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-2">Choose how to process this content:</div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => extractAsFactsMutation.mutate(doc.id)}
                          disabled={extractAsFactsMutation.isPending}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5"
                          data-testid={`button-extract-facts-${doc.id}`}
                        >
                          {extractAsFactsMutation.isPending ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-1"></i>
                              Extracting...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-brain mr-1"></i>
                              Extract as Facts
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => saveToContentLibraryMutation.mutate(doc.id)}
                          disabled={saveToContentLibraryMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="text-xs px-3 py-1.5 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          data-testid={`button-save-content-${doc.id}`}
                        >
                          {saveToContentLibraryMutation.isPending ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-1"></i>
                              Saving...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-book mr-1"></i>
                              Save as Content
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        <div><strong>Facts:</strong> Patch notes, game info, technical data (goes into Nicky's memory for RAG)</div>
                        <div><strong>Content:</strong> AITA posts, stories, entertainment (saved to content library)</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span>{formatFileSize(doc.size)}</span>
                      {doc.chunks && (
                        <span>{doc.chunks.length} chunks</span>
                      )}
                      <span>Added {new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                    {(doc.retrievalCount || 0) > 0 && (
                      <span className="text-accent">{doc.retrievalCount} retrievals</span>
                    )}
                  </div>
                  
                  {doc.processingStatus === 'PROCESSING' && (
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-accent h-1.5 rounded-full w-3/4 transition-all duration-300"></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Extracting knowledge...</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Document View Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <i className={viewingDocument ? getFileIcon(viewingDocument.contentType) : 'fas fa-file'}></i>
              {viewingDocument?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <div className="text-sm text-muted-foreground mb-4">
              {viewingDocument && (
                <div className="flex items-center gap-4">
                  <span>Size: {formatFileSize(viewingDocument.size)}</span>
                  <span>Added: {new Date(viewingDocument.createdAt).toLocaleDateString()}</span>
                  {viewingDocument.chunks && <span>Chunks: {viewingDocument.chunks.length}</span>}
                  {viewingDocument.retrievalCount > 0 && (
                    <span className="text-accent">Retrieved {viewingDocument.retrievalCount} times</span>
                  )}
                </div>
              )}
            </div>
            <div className="border border-border rounded-lg p-4 bg-muted/20">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
                {documentContent || 'Loading...'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
