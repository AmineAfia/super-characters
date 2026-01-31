import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base styles - Apple Liquid Glass inspired
  `relative inline-flex items-center justify-center gap-2
   font-semibold text-sm tracking-tight
   select-none cursor-pointer whitespace-nowrap
   transition-all duration-200 ease-apple
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background
   disabled:pointer-events-none disabled:opacity-40
   [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        // Primary - Solid filled button with glass-like depth
        default: `
          bg-primary text-primary-foreground
          shadow-glass-sm
          hover:brightness-110 hover:shadow-glass hover:-translate-y-0.5
          active:brightness-95 active:translate-y-0 active:shadow-glass-sm
        `,
        
        // Secondary - Translucent glass surface
        secondary: `
          bg-secondary text-secondary-foreground
          backdrop-blur-glass border border-glass-border
          shadow-glass-sm
          hover:bg-secondary/80 hover:shadow-glass hover:-translate-y-0.5
          active:bg-secondary active:translate-y-0
        `,
        
        // Outline - Glass border with transparent fill
        outline: `
          bg-transparent text-foreground
          border border-border hover:border-primary/50
          backdrop-blur-glass-light
          hover:bg-muted/50 hover:-translate-y-0.5
          active:bg-muted active:translate-y-0
        `,
        
        // Ghost - Minimal, no border
        ghost: `
          bg-transparent text-foreground
          hover:bg-muted/60 
          active:bg-muted/80
        `,
        
        // Destructive - System red with glass effect
        destructive: `
          bg-destructive text-destructive-foreground
          shadow-glass-sm
          hover:brightness-110 hover:shadow-glass hover:-translate-y-0.5
          active:brightness-95 active:translate-y-0
        `,
        
        // Link - Text only
        link: `
          text-primary underline-offset-4 
          hover:underline 
          bg-transparent hover:bg-transparent
        `,
        
        // Accent - System blue tinted glass
        accent: `
          bg-accent text-accent-foreground
          backdrop-blur-glass border border-primary/20
          shadow-glass-sm
          hover:bg-accent/80 hover:border-primary/30 hover:-translate-y-0.5
          active:translate-y-0
        `,
        
        // Glow - Animated glow effect for active states
        glow: `
          bg-primary text-primary-foreground
          animate-glow
          shadow-glass-glow
          hover:shadow-glass-lg hover:-translate-y-0.5
          active:translate-y-0
        `,
        
        // Glass - Pure liquid glass appearance
        glass: `
          glass-interactive
          text-foreground
          rounded-2xl
        `,
      },
      size: {
        default: "h-10 px-5 py-2 rounded-xl",
        sm: "h-8 px-4 py-1.5 text-xs rounded-lg",
        lg: "h-12 px-6 py-3 text-base rounded-xl",
        xl: "h-14 px-8 py-4 text-lg rounded-2xl",
        icon: "h-10 w-10 p-2 rounded-xl",
        "icon-sm": "h-8 w-8 p-1.5 rounded-lg",
        "icon-lg": "h-12 w-12 p-3 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
