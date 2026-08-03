"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function RefreshButton({ onClick, ariaLabel = "Refresh", disabled = false }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Refresh</span>
          </Button>
        </TooltipTrigger>
      </Tooltip>
    </TooltipProvider>
  );
}
