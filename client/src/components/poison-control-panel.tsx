
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Trash2, ShieldCheck, RefreshCw, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface PoisonedEntry {
    id: string;
    content: string;
    type: string;
    confidence: number | null;
    source: string | null;
}

interface PoisonScanResult {
    gibberish: PoisonedEntry[];
    brokenJson: PoisonedEntry[];
    aiSlop: PoisonedEntry[];
    repetitive: PoisonedEntry[];
    lowConfidence: PoisonedEntry[];
}

export function PoisonControlPanel({ profileId }: { profileId: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<string>("aiSlop");
    const [editingEntry, setEditingEntry] = useState<PoisonedEntry | null>(null);
    const [editContent, setEditContent] = useState("");

    const { data: issues, isLoading, refetch } = useQuery<PoisonScanResult>({
        queryKey: ["poison-scan", profileId],
        queryFn: async () => {
            const res = await fetch(`/api/memories/${profileId}/audit/poison`);
            if (!res.ok) throw new Error("Scan failed");
            return res.json();
        }
    });

    const batchActionMutation = useMutation({
        mutationFn: async ({ action, memoryIds, editData }: { action: 'DELETE' | 'VERIFY' | 'EDIT', memoryIds: string[], editData?: any }) => {
            const res = await fetch("/api/memories/batch-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, memoryIds, editData }),
            });
            if (!res.ok) throw new Error("Batch action failed");
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: `Processed ${data.count} entries.`,
            });
            setSelectedIds(new Set());
            setEditingEntry(null);
            refetch();
            queryClient.invalidateQueries({ queryKey: ["memories"] });
        },
        onError: () => {
            toast({ title: "Error", description: "Operation failed", variant: "destructive" });
        }
    });

    const handleSelectAll = (entries: PoisonedEntry[]) => {
        const newSelected = new Set(selectedIds);
        const allSelected = entries.every(e => newSelected.has(e.id));

        entries.forEach(e => {
            if (allSelected) newSelected.delete(e.id);
            else newSelected.add(e.id);
        });
        setSelectedIds(newSelected);
    };

    const currentEntries = issues ? (issues[activeTab as keyof PoisonScanResult] || []) : [];
    const selectedCount = currentEntries.filter(e => selectedIds.has(e.id)).length;

    const renderTab = (key: string, label: string, icon: React.ReactNode) => {
        const count = issues ? (issues[key as keyof PoisonScanResult] || []).length : 0;
        return (
            <TabsTrigger value={key} className="flex gap-2">
                {icon} {label} <Badge variant="secondary" className="ml-1">{count}</Badge>
            </TabsTrigger>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-red-500" /> Poison Control Center
                    </h2>
                    <p className="text-muted-foreground">Scan and purge corrupted or low-quality memories.</p>
                </div>
                <Button onClick={() => refetch()} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Run Forensic Scan
                </Button>
            </div>

            {issues && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Scan Results</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={selectedCount === 0}
                                    onClick={() => batchActionMutation.mutate({ action: 'DELETE', memoryIds: Array.from(selectedIds) })}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Purge Selected ({selectedCount})
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={selectedCount === 0}
                                    onClick={() => batchActionMutation.mutate({ action: 'VERIFY', memoryIds: Array.from(selectedIds) })}
                                >
                                    <ShieldCheck className="w-4 h-4 mr-2" /> Mark Safe ({selectedCount})
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid grid-cols-5 w-full">
                                {renderTab("aiSlop", "AI Slop", <AlertCircle className="w-4 h-4" />)}
                                {renderTab("gibberish", "Gibberish", <AlertCircle className="w-4 h-4" />)}
                                {renderTab("brokenJson", "Bad Code", <AlertCircle className="w-4 h-4" />)}
                                {renderTab("repetitive", "Loops", <AlertCircle className="w-4 h-4" />)}
                                {renderTab("lowConfidence", "Low Conf.", <AlertCircle className="w-4 h-4" />)}
                            </TabsList>

                            <div className="mt-4 border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">
                                                <Checkbox
                                                    checked={currentEntries.length > 0 && currentEntries.every(e => selectedIds.has(e.id))}
                                                    onCheckedChange={() => handleSelectAll(currentEntries)}
                                                />
                                            </TableHead>
                                            <TableHead>Content Preview</TableHead>
                                            <TableHead className="w-[100px]">Source</TableHead>
                                            <TableHead className="w-[100px]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentEntries.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                    No issues detected in this category.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentEntries.map(entry => (
                                                <TableRow key={entry.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedIds.has(entry.id)}
                                                            onCheckedChange={(checked) => {
                                                                const newSet = new Set(selectedIds);
                                                                if (checked) newSet.add(entry.id);
                                                                else newSet.delete(entry.id);
                                                                setSelectedIds(newSet);
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {entry.content.length > 120 ? entry.content.substring(0, 120) + "..." : entry.content}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {entry.source || "Unknown"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => {
                                                            setEditingEntry(entry);
                                                            setEditContent(entry.content);
                                                        }}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </Tabs>
                    </CardContent>
                </Card>
            )}

            <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Memory Entry</DialogTitle>
                        <DialogDescription>Fix the content or correct the mistake.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[150px]"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancel</Button>
                        <Button onClick={() => {
                            if (editingEntry) {
                                batchActionMutation.mutate({
                                    action: 'EDIT',
                                    memoryIds: [editingEntry.id],
                                    editData: { content: editContent }
                                });
                            }
                        }}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
