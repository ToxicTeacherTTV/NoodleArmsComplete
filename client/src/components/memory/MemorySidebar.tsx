import { Brain, Search, Wrench, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type MemorySectionId = 'what-nicky-knows' | 'review-fix' | 'insights';

interface MemorySidebarProps {
  currentSection: MemorySectionId;
  onSectionChange: (section: MemorySectionId) => void;
  className?: string;
}

const sections = [
  {
    id: 'what-nicky-knows' as const,
    icon: Brain,
    label: "What Nicky Knows",
    description: "Browse, search, and explore everything in Nicky's memory. View recent memories, all facts, entities, documents, and podcasts."
  },
  {
    id: 'review-fix' as const,
    icon: Search,
    label: "Review & Fix",
    description: "Find and fix problematic memories. Review contradictions, duplicates, low-confidence facts, and flagged content."
  },
  {
    id: 'insights' as const,
    icon: BarChart3,
    label: "Insights",
    description: "Understand memory health and patterns. View analytics, AI insights, timeline consistency, and system status."
  }
];

export default function MemorySidebar({ currentSection, onSectionChange, className }: MemorySidebarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("w-64 border-r bg-muted/20 p-4 space-y-2", className)}>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Memory</h2>
          <p className="text-xs text-muted-foreground">
            View and manage everything Nicky knows
          </p>
        </div>

        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = currentSection === section.id;

            return (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSectionChange(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate text-left">{section.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm">{section.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Quick Actions Separator */}
        <div className="pt-6 mt-6 border-t">
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
            <Wrench className="h-4 w-4" />
            <span>Quick Actions</span>
          </div>
          <p className="px-3 text-xs text-muted-foreground mt-1">
            Find common tools in the top-right dropdown
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
