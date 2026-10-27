/**
 * Lightweight, zero-CPU structural fixtures for below-the-fold sections.
 * Guarantees zero Cumulative Layout Shift (CLS) and instant paint while
 * heavy interactive models stream in asynchronously.
 */

export function KnowledgeMapFixture() {
  return (
    <section id="learn" aria-hidden="true" className="relative overflow-hidden bg-paper-2 py-28 md:py-36 min-h-[580px]">
      <div className="shell">
        <div className="h-9 w-64 rounded-xl bg-line/60 mb-6" />
        <div className="panel h-[420px] rounded-[32px] bg-surface/40" />
      </div>
    </section>
  );
}

export function HistoryGraphFixture() {
  return (
    <section id="history" aria-hidden="true" className="relative overflow-hidden py-28 md:py-36 min-h-[600px]">
      <div className="shell">
        <div className="h-9 w-72 rounded-xl bg-line/60 mb-6" />
        <div className="panel h-[440px] rounded-[32px] bg-surface/40" />
      </div>
    </section>
  );
}

export function ContentAddressingFixture() {
  return (
    <section id="identity" aria-hidden="true" className="relative overflow-hidden bg-paper-2 py-28 md:py-36 min-h-[580px]">
      <div className="shell">
        <div className="h-9 w-64 rounded-xl bg-line/60 mb-6" />
        <div className="panel h-[380px] rounded-[28px] bg-surface/40" />
      </div>
    </section>
  );
}

export function JourneyFixture() {
  return (
    <section id="journey" aria-hidden="true" className="relative h-[440vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <div className="shell">
          <div className="h-9 w-80 rounded-xl bg-line/60 mb-8 mx-auto" />
          <div className="panel h-[320px] rounded-3xl bg-surface/40 max-w-[50rem] mx-auto" />
        </div>
      </div>
    </section>
  );
}

export function ClosingCTAFixture() {
  return (
    <section aria-hidden="true" className="night relative grid overflow-hidden border-t border-line lg:min-h-[640px]">
      <div className="p-16">
        <div className="h-12 w-96 rounded-xl bg-line/50 mb-6" />
        <div className="h-6 w-64 rounded-lg bg-line/40" />
      </div>
    </section>
  );
}
