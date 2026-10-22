import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { LabProvider } from "@/components/lab/LabProvider";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Transformation } from "@/components/sections/Transformation";
import { SnapshotLab } from "@/components/sections/SnapshotLab";
import { DiffView } from "@/components/sections/DiffView";
import { KnowledgeMap } from "@/components/sections/KnowledgeMap";
import { HistoryGraph } from "@/components/sections/HistoryGraph";
import { ContentAddressing } from "@/components/sections/ContentAddressing";
import { Journey } from "@/components/sections/Journey";
import { ClosingCTA } from "@/components/sections/ClosingCTA";

export default function Home() {
  return (
    <>
      <a
        href="#problem"
        className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Transformation />
        <LabProvider>
          <SnapshotLab />
          <DiffView />
        </LabProvider>
        <KnowledgeMap />
        <HistoryGraph />
        <ContentAddressing />
        <Journey />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
