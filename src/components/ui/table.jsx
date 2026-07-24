import { cn } from "@/lib/utils";
export const Table = ({ className, ...props }) => <div className="relative w-full overflow-auto"><table className={cn("w-full caption-bottom text-sm", className)} {...props} /></div>;
export const TableHeader = ({ className, ...props }) => <thead className={cn("[&_tr]:border-b [&_tr]:border-border/70", className)} {...props} />;
export const TableBody = ({ className, ...props }) => <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
export const TableFooter = ({ className, ...props }) => <tfoot className={cn("border-t bg-muted/50 font-medium", className)} {...props} />;
export const TableRow = ({ className, ...props }) => <tr className={cn("border-b border-border/60 transition-colors duration-150 hover:bg-muted/50", className)} {...props} />;
export const TableHead = ({ className, ...props }) => <th className={cn("h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)} {...props} />;
export const TableCell = ({ className, ...props }) => <td className={cn("p-3 align-middle", className)} {...props} />;
