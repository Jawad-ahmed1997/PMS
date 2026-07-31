"use client";

import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./button";
import { useTheme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeToggle({ className = "" }) {
  const { currentTheme: theme, setTheme } = useTheme();
  const currentTheme = THEMES.find((item) => item.value === theme) ?? THEMES[2];
  const CurrentIcon = currentTheme.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="default"
          aria-label={`Theme: ${currentTheme.label}`}
          title={`Theme: ${currentTheme.label}`}
          className={`h-10 min-w-[7.5rem] shrink-0 justify-between gap-2 rounded-xl px-4 shadow-none ${className}`}
        >
          <CurrentIcon className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 text-left">{currentTheme.label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {THEMES.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            aria-current={theme === value ? "true" : undefined}
          >
            <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
            {theme === value ? <Check className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
