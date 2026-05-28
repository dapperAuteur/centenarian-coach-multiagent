// src/app/walkthrough/page.tsx
// Embed the 8-minute walkthrough video. The embed URL is read from
// NEXT_PUBLIC_WALKTHROUGH_EMBED_URL (the iframe-ready URL — e.g.
// https://www.youtube.com/embed/<id> or https://player.vimeo.com/video/<id>).
// When the env var is empty, render a "coming soon" placeholder with a link
// to the script.

import Link from "next/link";

export const metadata = {
  title: "Walkthrough | Centenarian Coach Multi-Agent",
  description:
    "An 8-minute tour of the supervisor + specialist architecture and a live cross-domain query.",
};

export default function WalkthroughPage() {
  const embedUrl = process.env.NEXT_PUBLIC_WALKTHROUGH_EMBED_URL;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs text-gray-500">
        <Link href="/" className="hover:underline">
          ← Home
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Walkthrough</h1>
      <p className="mt-2 text-sm text-gray-500">
        An 8-minute tour of the supervisor + specialist architecture and a live
        cross-domain query.
      </p>

      {embedUrl ? (
        <div className="mt-8 aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-black">
          <iframe
            src={embedUrl}
            title="Centenarian Coach walkthrough"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-700">
          Video coming soon. The recording follows the timed script in{" "}
          <a
            href="https://github.com/dapperAuteur/centenarian-coach-multiagent/blob/main/docs/walkthrough.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-900"
          >
            docs/walkthrough.md
          </a>
          . Set <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_WALKTHROUGH_EMBED_URL</code>{" "}
          to the iframe-ready embed URL (e.g. <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">https://www.youtube.com/embed/&lt;id&gt;</code>) and redeploy.
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/coach"
          className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          Try the coach →
        </Link>
        <Link
          href="/guide"
          className="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-800 hover:bg-gray-50"
        >
          Read the guide
        </Link>
        <a
          href="https://github.com/dapperAuteur/centenarian-coach-multiagent"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-800 hover:bg-gray-50"
        >
          Source ↗
        </a>
      </div>
    </main>
  );
}
