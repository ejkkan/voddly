import * as React from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface IconButton {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  variant?: "default" | "ghost" | "outline" | "secondary";
}

interface ContentHeaderProps {
  title: string;
  description?: string;
  iconButtons?: IconButton[];
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function ContentHeader({
  title,
  description,
  iconButtons = [],
  className,
  titleClassName,
  descriptionClassName,
}: ContentHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      {/* Left side: Title and description */}
      <div className="flex-1 space-y-3">
        <h1
          className={cn(
            "text-foreground text-5xl leading-tight font-bold tracking-tight lg:text-6xl",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              "text-muted-foreground max-w-4xl text-2xl leading-relaxed lg:text-3xl",
              descriptionClassName,
            )}
          >
            {description}
          </p>
        )}
      </div>

      {/* Right side: Icon buttons */}
      {iconButtons.length > 0 && (
        <div className="ml-8 flex items-center gap-4">
          {iconButtons.map((button, index) => (
            <Button
              key={index}
              variant={button.variant || "ghost"}
              size="icon"
              onClick={button.onClick}
              className="h-16 w-16 rounded-full text-lg transition-transform duration-200 hover:scale-110 lg:h-20 lg:w-20"
              aria-label={button.label}
            >
              <span className="scale-125 lg:scale-150">{button.icon}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
