import { Wrench, Scissors, Zap, Scan, Clock, Download, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickActionsMenuProps {
  onCleanWallOfText: () => void;
  onPropagateImportance: () => void;
  onRunMemoryChecker: () => void;
  onRepairTimeline: () => void;
  onExportMemories: () => void;
  onImportMemories: () => void;
}

const actions = [
  {
    id: 'clean',
    label: 'Clean Wall of Text',
    description: 'Break long memories into concise atomic facts. Makes memories easier to retrieve and reduces redundancy.',
    icon: Scissors,
    handler: 'onCleanWallOfText'
  },
  {
    id: 'propagate',
    label: 'Propagate Importance',
    description: 'Recalculate importance scores for all memories based on how often they\'re referenced and their confidence level.',
    icon: Zap,
    handler: 'onPropagateImportance'
  },
  {
    id: 'checker',
    label: 'Run Memory Checker',
    description: 'Scan all memories for quality issues: low confidence facts, contradictions, missing sources, orphaned entities. Run monthly.',
    icon: Scan,
    handler: 'onRunMemoryChecker'
  },
  {
    id: 'timeline',
    label: 'Repair Timeline',
    description: 'Fix conflicting dates in event memories. Resolves when Nicky has different dates for the same event.',
    icon: Clock,
    handler: 'onRepairTimeline'
  }
];

export default function QuickActionsMenu(props: QuickActionsMenuProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Wrench className="h-4 w-4" />
                Quick Actions
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Common maintenance tools</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance Tools
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {actions.map((action) => {
            const Icon = action.icon;
            const handler = props[action.handler as keyof QuickActionsMenuProps] as () => void;

            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    onClick={handler}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-sm">{action.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          <DropdownMenuSeparator />

          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuItem
                onClick={props.onExportMemories}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Export Memories</span>
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-sm">Download backup as JSON</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuItem
                onClick={props.onImportMemories}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Import Memories</span>
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-sm">Restore from backup file</p>
            </TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
