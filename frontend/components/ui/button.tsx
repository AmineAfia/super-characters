import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative font-medium inline-flex items-center cursor-pointer select-none justify-center rounded-full text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary: White background, black text
        default:
          "bg-white text-black hover:bg-gray-100 border border-transparent",
        // Secondary: Dark background, white text
        secondary:
          "bg-polar-800 text-white hover:bg-polar-700 border border-polar-700",
        // Outline: Transparent with border
        outline:
          "bg-transparent text-white hover:bg-polar-800 border border-polar-600",
        // Ghost: Transparent, no border
        ghost:
          "bg-transparent text-white hover:bg-polar-800",
        destructive:
          "bg-red-500 dark:bg-red-600 text-white hover:bg-red-400 dark:hover:bg-red-500",
        link: "text-blue-400 underline-offset-4 hover:underline bg-transparent hover:bg-transparent",
        // Accent variant
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-4 py-1.5 text-xs",
        lg: "h-12 px-6 py-3",
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
