import dynamic from "next/dynamic";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { LogRail } from "@/components/site/LogRail";
import { LabProvider } from "@/components/lab/LabProvider";
// The scroll-driven banner.
import { HeroDive as Hero } from "@/components/sections/HeroDive";
import { Problem } from "@/components/sections/Problem";
import { Transformation } from "@/components/sections/Transformation";
import { SnapshotLab } from "@/components/sections/SnapshotLab";
import { DiffView } from "@/components/sections/DiffView";
import {
  KnowledgeMapFixture,
  HistoryGraphFixture,
  ContentAddressingFixture,
  JourneyFixture,
  ClosingCTAFixture,
} from "@/components/sections/SectionFixtures";

// Below-the-fold interactive sections loaded progressively with zero-CLS fixtures
const KnowledgeMap = dynamic(
  () => import("@/components/sections/KnowledgeMap").then((m) => m.KnowledgeMap),
  { loading: () => <KnowledgeMapFixture /> },
);
const HistoryGraph = dynamic(
  () => import("@/components/sections/HistoryGraph").then((m) => m.HistoryGraph),
  { loading: () => <HistoryGraphFixture /> },
);
const ContentAddressing = dynamic(
  () => import("@/components/sections/ContentAddressing").then((m) => m.ContentAddressing),
  { loading: () => <ContentAddressingFixture /> },
);
const Journey = dynamic(
  () => import("@/components/sections/Journey").then((m) => m.Journey),
  { loading: () => <JourneyFixture /> },
);
const ClosingCTA = dynamic(
  () => import("@/components/sections/ClosingCTA").then((m) => m.ClosingCTA),
  { loading: () => <ClosingCTAFixture /> },
);

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
      <LogRail />
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
