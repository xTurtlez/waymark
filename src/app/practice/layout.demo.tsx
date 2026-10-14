import type { Metadata } from "next";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Practice",
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider mode="demo">
      <PracticeShell>{children}</PracticeShell>
    </StoreProvider>
  );
}
