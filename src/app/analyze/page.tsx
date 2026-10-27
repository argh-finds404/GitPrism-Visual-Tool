import type { Metadata } from "next";
import { AnalyzeApp } from "@/components/upload/AnalyzeApp";

export const metadata: Metadata = {
  title: "Analyse your project — GitPrism",
  description:
    "Pick a folder from your own machine and see its dependency graph, import cycles and unresolved imports. Read in your browser; nothing is uploaded and nothing is executed.",
};

export default function AnalyzePage() {
  return <AnalyzeApp />;
}
