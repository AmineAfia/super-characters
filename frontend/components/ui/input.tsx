import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base layout
          "flex h-10 w-full px-4 py-2",
          "text-sm text-foreground",
          
          // Liquid Glass input styling
          "bg-input backdrop-blur-glass-light",
          "border border-border rounded-xl",
          "shadow-glass-inset",
          
          // Placeholder
          "placeholder:text-muted-foreground",
          
          // File input
          "file:border-0 file:bg-transparent",
          "file:text-sm file:font-medium file:text-foreground",
          
          // Focus state - Apple-style ring
          "transition-all duration-200 ease-apple",
          "focus-visible:outline-none",
          "focus-visible:border-primary",
          "focus-visible:ring-2 focus-visible:ring-primary/20",
          "focus-visible:shadow-glass-sm",
          
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          
          // Range input special styling
          type === "range" && [
            "h-2 p-0 rounded-full",
            "bg-muted border-none shadow-none",
            "cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:shadow-glass-sm",
            "[&::-webkit-slider-thumb]:cursor-grab",
            "[&::-webkit-slider-thumb]:active:cursor-grabbing",
            "[&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:hover:scale-110",
          ],
          
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
