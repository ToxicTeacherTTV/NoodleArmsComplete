import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface JazzChatLayoutProps {
    sidebarContent: ReactNode;
    chatPanelContent: ReactNode;
    composerContent: ReactNode;
    rightPanelContent: ReactNode;
    messageCount: number;
}

export const JazzChatLayout = ({
    sidebarContent,
    chatPanelContent,
    composerContent,
    rightPanelContent,
    messageCount
}: JazzChatLayoutProps) => {
    return (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_320px] h-[calc(100vh-12rem)]">
            {/* Sidebar: Conversation History (Desktop) */}
            <Card className="hidden lg:flex flex-col min-h-0 overflow-hidden card-hover">
                <CardHeader className="border-b px-4 py-3">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        Conversations
                        <Badge variant="secondary">{messageCount}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden">
                    {sidebarContent}
                </CardContent>
            </Card>

            {/* Main Chat Area */}
            <div className="flex flex-col gap-4 min-h-0">
                {/* Chat Panel */}
                <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-jazz">
                    <CardContent className="flex-1 p-0 flex flex-col min-h-0">
                        {chatPanelContent}
                    </CardContent>
                </Card>

                {/* Message Composer */}
                {composerContent}
            </div>

            {/* Right Sidebar: Quick Info (Desktop XL+) */}
            <Card className="hidden xl:flex flex-col min-h-0 overflow-hidden card-hover">
                <CardHeader className="border-b px-4 py-3">
                    <CardTitle className="text-sm font-semibold">Command Center</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                    {rightPanelContent}
                </CardContent>
            </Card>
        </div>
    );
};
