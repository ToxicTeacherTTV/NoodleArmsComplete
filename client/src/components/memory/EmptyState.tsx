import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

interface EmptyStateProps {
  icon?: string | LucideIcon;
  title: string;
  description: string | React.ReactNode;
  actions?: EmptyStateAction[];
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actions,
  className
}: EmptyStateProps) {
  const IconComponent = icon && typeof icon !== 'string' ? icon : null;

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className || ''}`}>
      {/* Icon */}
      <div className="mb-4">
        {IconComponent ? (
          <IconComponent className="h-12 w-12 text-muted-foreground/50" />
        ) : (
          <span className="text-5xl">{icon || '📝'}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      <div className="text-sm text-muted-foreground max-w-md mb-6">
        {typeof description === 'string' ? (
          <p>{description}</p>
        ) : (
          description
        )}
      </div>

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
