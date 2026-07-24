import { forwardRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";
const ScrollArea = forwardRef(function ScrollArea({ className = "", children, ...props }, ref) { return <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}><ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport><ScrollAreaPrimitive.Scrollbar orientation="vertical"><ScrollAreaPrimitive.Thumb /></ScrollAreaPrimitive.Scrollbar><ScrollAreaPrimitive.Scrollbar orientation="horizontal"><ScrollAreaPrimitive.Thumb /></ScrollAreaPrimitive.Scrollbar></ScrollAreaPrimitive.Root>; });
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;
export default ScrollArea;
