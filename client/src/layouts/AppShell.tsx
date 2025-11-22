import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AppShellProps {
    children: ReactNode;
    activeProfile?: { name: string };
}

const tabs = [
    { id: "chat", label: "Chat", icon: "fa-comments", path: "/" },
    { id: "brain", label: "Brain", icon: "fa-brain", path: "/brain" },
    { id: "podcast", label: "Podcast", icon: "fa-podcast", path: "/workspace" },
    { id: "analytics", label: "Analytics", icon: "fa-chart-line", path: "/listener-cities" },
];

export default function AppShell({ children, activeProfile }: AppShellProps) {
    const [location, setLocation] = useLocation();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [notesModalOpen, setNotesModalOpen] = useState(false);

    const activeTab = tabs.find(tab => tab.path === location) || tabs[0];

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            {/* Top Bar */}
            <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between px-4">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
                            <span className="text-2xl">🎷</span>
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-lg font-bold tracking-tight">
                                {activeProfile?.name || "Nicky A.I. Dente"}
                            </h1>
                            <p className="text-xs text-muted-foreground">"Noodle Arms" Co-Host</p>
                        </div>
                    </div>

                    {/* Settings Menu */}
                    <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10">
                                <i className="fas fa-gear text-lg" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => setProfileModalOpen(true)}>
                                <i className="fas fa-user-astronaut mr-2" />
                                Profile Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setNotesModalOpen(true)}>
                                <i className="fas fa-note-sticky mr-2" />
                                Notes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <i className="fas fa-palette mr-2" />
                                Theme
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <i className="fas fa-keyboard mr-2" />
                                Keyboard Shortcuts
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Tab Navigation */}
                <div className="border-t bg-muted/30">
                    <div className="container">
                        <nav className="flex items-center gap-1 overflow-x-auto px-2" role="tablist">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setLocation(tab.path)}
                                    className={cn(
                                        "relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
                                        "hover:text-foreground",
                                        activeTab.id === tab.id
                                            ? "text-primary"
                                            : "text-muted-foreground"
                                    )}
                                    role="tab"
                                    aria-selected={activeTab.id === tab.id}
                                >
                                    <i className={`fas ${tab.icon}`} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {activeTab.id === tab.id && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container py-6">
                {children}
            </main>
        </div>
    );
}
