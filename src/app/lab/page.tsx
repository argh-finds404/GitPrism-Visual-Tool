import type { Metadata } from "next";
import { Workbench } from "@/components/workbench/Workbench";

export const metadata: Metadata = {
  title: "Lab — GitPrism",
  description: "Edit files, stage changes, commit, and inspect the blobs, trees and commits Git creates.",
};

export default function LabPage() {
  return <Workbench />;
}
