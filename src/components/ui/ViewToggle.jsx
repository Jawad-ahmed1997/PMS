"use client";
import { Grid2X2, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export default function ViewToggle({ value, onChange }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onChange(nextValue);
      }}
      aria-label="Project view"
      className="rounded-lg border border-border bg-muted/50 p-1"
    >
      <ToggleGroupItem
        value="grid"
        title="Grid view"
        aria-label="Grid view"
        className="h-8 gap-1.5 rounded-md px-2.5 text-muted-foreground hover:bg-background hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Grid2X2 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Grid</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="list"
        title="List view"
        aria-label="List view"
        className="h-8 gap-1.5 rounded-md px-2.5 text-muted-foreground hover:bg-background hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <List className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">List</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
