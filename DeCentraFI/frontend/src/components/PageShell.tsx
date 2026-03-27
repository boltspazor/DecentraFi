import type { ReactNode } from "react";

const maxWidthClass = {
  narrow: "max-w-3xl",
  medium: "max-w-4xl",
  wide: "max-w-6xl",
} as const;

type Props = {
  children: ReactNode;
  className?: string;
  maxWidth?: keyof typeof maxWidthClass;
};

export function PageShell({ children, className = "", maxWidth = "wide" }: Props) {
  return (
    <div
      className={`mx-auto w-full ${maxWidthClass[maxWidth]} px-4 sm:px-6 lg:px-8 py-8 sm:py-10 ${className}`}
    >
      {children}
    </div>
  );
}
