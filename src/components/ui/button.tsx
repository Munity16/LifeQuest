import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(function Button({
  className,
  variant = "primary",
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "button",
        variant === "primary" && "button-primary",
        variant === "secondary" && "button-secondary",
        variant === "ghost" && "button-ghost",
        variant === "danger" && "button-danger",
        className,
      )}
      {...props}
    />
  );
});
