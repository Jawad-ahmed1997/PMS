"use client";

import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function formatDate(date) {
  if (!date) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function DatePicker({ name, value, onChange, min, max, disabled, required, placeholder = "Select date" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full justify-start gap-2 font-normal">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <Calendar
          mode="single"
          selected={value ? new Date(`${value}T00:00:00`) : undefined}
          disabled={[
            ...(min ? [{ before: new Date(`${min}T00:00:00`) }] : []),
            ...(max ? [{ after: new Date(`${max}T00:00:00`) }] : []),
          ]}
          onSelect={(date) => {
            if (date) onChange({ target: { name, value: formatDate(date) } });
          }}
          initialFocus
        />
      </PopoverContent>
      {required ? <Input tabIndex={-1} aria-hidden="true" className="sr-only" name={name} value={value ?? ""} required readOnly /> : null}
    </Popover>
  );
}
