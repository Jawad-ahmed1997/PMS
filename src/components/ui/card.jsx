import { cn } from "@/lib/utils";
export const Card = ({ className, ...props }) => <div className={cn("rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out", className)} {...props} />;
export const CardHeader = ({ className, ...props }) => <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
export const CardTitle = ({ className, ...props }) => <h3 className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
export const CardDescription = ({ className, ...props }) => <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
export const CardContent = ({ className, ...props }) => <div className={cn("p-6 pt-0", className)} {...props} />;
