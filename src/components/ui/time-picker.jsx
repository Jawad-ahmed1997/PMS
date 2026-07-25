"use client";

import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function TimePicker({ name, value, onChange, disabled, required, placeholder = "Select time" }) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  const hour24 = match ? Number(match[1]) : 0;
  const minute = match?.[2] ?? "";
  const hour = match ? String(((hour24 + 11) % 12) + 1) : "";
  const period = match ? (hour24 >= 12 ? "PM" : "AM") : "";

  const emit = (nextHour, nextMinute, nextPeriod) => {
    if (!nextHour || !nextMinute || !nextPeriod) return;
    let next = Number(nextHour) % 12;
    if (nextPeriod === "PM") next += 12;
    onChange({ target: { name, value: `${String(next).padStart(2, "0")}:${nextMinute}` } });
  };

  const update = (part, nextValue) => {
    emit(part === "hour" ? nextValue : hour, part === "minute" ? nextValue : minute, part === "period" ? nextValue : period);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full justify-start gap-2 font-normal">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[18rem] p-3">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
          <Select value={hour || undefined} onValueChange={(next) => update("hour", next)}>
            <SelectTrigger aria-label="Hour"><SelectValue placeholder="HH" /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <SelectItem key={item} value={String(item)}>{String(item).padStart(2, "0")}</SelectItem>)}</SelectContent>
          </Select>
          <span className="pb-2 text-muted-foreground">:</span>
          <Select value={minute || undefined} onValueChange={(next) => update("minute", next)}>
            <SelectTrigger aria-label="Minute"><SelectValue placeholder="MM" /></SelectTrigger>
            <SelectContent>{Array.from({ length: 60 }, (_, item) => String(item).padStart(2, "0")).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={period || undefined} onValueChange={(next) => update("period", next)}>
            <SelectTrigger aria-label="AM or PM"><SelectValue placeholder="AM" /></SelectTrigger>
            <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
          </Select>
        </div>
      </PopoverContent>
      {required ? <Input tabIndex={-1} aria-hidden="true" className="sr-only" name={name} value={value ?? ""} required readOnly /> : null}
    </Popover>
  );
}
