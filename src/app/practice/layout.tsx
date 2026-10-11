import type { Metadata } from "next";
import { PracticeShell } from "@/components/practice/PracticeShell";

export const metadata: Metadata = {
  title: "Practice",
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <PracticeShell>{children}</PracticeShell>;
}
