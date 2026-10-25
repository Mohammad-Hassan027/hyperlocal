import Link from "next/link";
import { CATEGORIES } from "@/lib/seed";

export default function Landing() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
      {/* The flyer: tear-off tabs double as the trade picker */}
      <section aria-labelledby="hero-title" className="flyer relative mt-2">
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-chilli shadow-[0_2px_0_rgb(15_26_77/0.45)]"
        />
        <div className="px-6 pb-8 pt-10 sm:px-10 sm:pt-12">
          <h1 id="hero-title" className="text-[2.6rem] sm:text-6xl">
            Tap leaking? Fan stopped spinning?
          </h1>
          <p className="mt-5 max-w-lg text-xl">
            Someone skilled, a few streets away, can be at your door in about 30 minutes. Say what
            you can pay. They accept, or suggest a fairer price.
          </p>
          <p lang="hi" className="mt-3 text-lg text-muted">
            काम बताइए, कारीगर पास ही है।
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/customer" className="btn btn-go text-lg">
              Find help near me
            </Link>
            <Link href="/worker" className="font-semibold underline underline-offset-4">
              I&apos;m a worker
            </Link>
          </div>
        </div>

        <nav aria-label="Pick a trade" className="tear-t grid grid-cols-2 sm:flex">
          {CATEGORIES.map((c, i) => (
            <Link
              key={c.id}
              href={`/customer?cat=${c.id}`}
              style={{ background: c.tone }}
              className={`flex min-h-12 flex-1 items-center justify-center border-dashed border-ink/35 px-3 py-2 font-bold transition-transform duration-150 hover:translate-y-1.5 hover:rotate-[1.2deg] motion-reduce:transform-none sm:h-44 sm:px-0 sm:py-4 ${
                i > 1 ? "border-t-2 sm:border-t-0" : ""
              } ${i % 2 === 1 ? "border-l-2" : i > 0 ? "sm:border-l-2" : ""}`}
            >
              <span className="sm:rotate-180 sm:[writing-mode:vertical-rl]">{c.label}</span>
            </Link>
          ))}
        </nav>
      </section>

      <aside className="space-y-8 lg:pt-6">
        <ol className="space-y-6">
          <li className="tear-b pb-6">
            <h2 className="text-2xl">Say what&apos;s wrong</h2>
            <p className="mt-1.5 text-muted">
              Pick a trade, write a line about the job, and set a budget you&apos;re comfortable with.
            </p>
          </li>
          <li className="tear-b pb-6">
            <h2 className="text-2xl">Workers nearby reply</h2>
            <p className="mt-1.5 text-muted">
              Everyone online within your radius sees it. They take the job at your price or counter
              with their own.
            </p>
          </li>
          <li>
            <h2 className="text-2xl">Pick, track, rate</h2>
            <p className="mt-1.5 text-muted">
              Choose the offer you like. Every profile shows what&apos;s been checked: ID,
              background and skills.
            </p>
          </li>
        </ol>

        <p className="rounded-md bg-marigold-soft p-4 text-ink">
          <b>Work in Thane, Bhiwandi or Kalyan?</b> Open the{" "}
          <Link href="/worker" className="font-bold underline underline-offset-4">
            Worker view
          </Link>{" "}
          to go online and start taking jobs.
        </p>

        <p className="text-sm text-muted">
          This is a hackathon demo. Every worker, rating and badge shown is sample data.
        </p>
      </aside>
    </div>
  );
}
