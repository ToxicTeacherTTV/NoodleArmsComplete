import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

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
                  
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span>{formatFileSize(doc.size)}</span>
                      {doc.chunks && (
                        <span>{doc.chunks.length} chunks</span>
                      )}
                      <span>Added {new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                    {doc.retrievalCount > 0 && (
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
    </div>
  );
}
