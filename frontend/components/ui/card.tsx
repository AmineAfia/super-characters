import * as React from "react";

import { cn } from "@/lib/utils";

const Card = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			// Apple Liquid Glass card styling
			"relative overflow-hidden",
			"rounded-2xl",
			"bg-card backdrop-blur-glass",
			"border border-glass-border",
			"shadow-glass",
			// Specular highlight overlay
			"before:absolute before:inset-0 before:pointer-events-none",
			"before:bg-gradient-to-br before:from-white/20 before:via-white/5 before:to-transparent",
			"before:rounded-[inherit]",
			className,
		)}
		{...props}
	/>
);
Card.displayName = "Card";

const CardHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div 
		className={cn(
			"flex flex-col space-y-1.5 p-6",
			className
		)} 
		{...props} 
	/>
);
CardHeader.displayName = "CardHeader";

const CardTitle = ({
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
	<h3
		className={cn(
			"font-semibold text-lg leading-none tracking-tight text-card-foreground",
			className
		)}
		{...props}
	/>
);
CardTitle.displayName = "CardTitle";

const CardDescription = ({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
	<p 
		className={cn(
			"text-sm text-muted-foreground",
			className
		)} 
		{...props} 
	/>
);
CardDescription.displayName = "CardDescription";

const CardContent = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("p-6 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div 
		className={cn(
			"flex items-center p-6 pt-0",
			className
		)} 
		{...props} 
	/>
);
CardFooter.displayName = "CardFooter";

export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription,
	CardContent,
};
