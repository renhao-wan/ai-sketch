import type { ReactNode } from "react";

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg)]">
      {children}
    </div>
  );
}
