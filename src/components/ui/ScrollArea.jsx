import { forwardRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export const ScrollBar = ({ orientation = "vertical", className, ...props }) => (
  <ScrollAreaPrimitive.Scrollbar
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors duration-200",
      orientation === "vertical"
        ? "h-full w-2.5 border-l border-l-transparent p-px"
        : "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border/80 transition-colors hover:bg-foreground/45" />
  </ScrollAreaPrimitive.Scrollbar>
);

const ScrollArea = forwardRef(function ScrollArea({ className = "", viewportClassName, children, type = "auto", ...props }, ref) {
  return (
    <ScrollAreaPrimitive.Root ref={ref} type={type} className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className={cn("h-full w-full rounded-[inherit]", viewportClassName)}>{children}</ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;
export default ScrollArea;
