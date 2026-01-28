import { Drama, Plug, Radio, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SettingsSectionId = 'personality' | 'integrations' | 'content-pipeline' | 'system';

interface SettingsSidebarProps {
  currentSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  className?: string;
}

const sections = [
  {
    id: 'personality' as const,
    icon: Drama,
    label: "Personality",
    description: "Define how Nicky thinks and speaks. Configure personality presets, heat controls, chaos mode, and voice settings."
  },
  {
    id: 'integrations' as const,
    icon: Plug,
    label: "Integrations",
    description: "Connect Nicky to Discord, Twitch, and other platforms. Manage API keys and credentials."
  },
  {
    id: 'content-pipeline' as const,
    icon: Radio,
    label: "Content Pipeline",
    description: "Manage how content flows into Nicky's brain. Configure RSS feeds, auto-ingestion rules, and content libraries."
  },
  {
    id: 'system' as const,
    icon: SettingsIcon,
    label: "System",
    description: "Core system configuration. Manage profiles, debug settings, and view system operations status."
  }
];

export default function SettingsSidebar({ currentSection, onSectionChange, className }: SettingsSidebarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("w-64 border-r bg-muted/20 p-4 space-y-2", className)}>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Settings</h2>
          <p className="text-xs text-muted-foreground">
            Configure Nicky's behavior and integrations
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
      </div>
    </TooltipProvider>
  );
}
