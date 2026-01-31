import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative font-semibold inline-flex items-center cursor-pointer select-none justify-center rounded-2xl text-sm ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary: Soft peach, warm and inviting
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5",
        // Secondary: Lavender background
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-soft",
        // Outline: Soft border with transparent bg
        outline:
          "bg-transparent text-foreground hover:bg-muted border border-border hover:border-primary/50",
        // Ghost: Minimal, transparent
        ghost:
          "bg-transparent text-foreground hover:bg-muted/50",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline bg-transparent hover:bg-transparent",
        // Accent: Iridescent blue
        accent: "bg-accent text-accent-foreground hover:bg-accent/80 shadow-soft",
        // Soft glow variant for recording states
        glow: "bg-primary text-primary-foreground animate-glow hover:shadow-glow-lg",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-4 py-1.5 text-xs",
        lg: "h-12 px-6 py-3 text-base",
        icon: "flex items-center justify-center h-10 w-10 p-2",
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
