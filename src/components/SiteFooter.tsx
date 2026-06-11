// src/components/SiteFooter.tsx
// Ecosystem footer. Same structure across the WitUS ecosystem (witus.online +
// siblings). Three regions:
//   1. Product header — WitUS logomark + product name + one-line summary.
//   2. Rise Wellness callout — canonical copy, byte-identical disclaimer.
//   3. Three-column nav (Ecosystem · this app · Partners & Legal).
//
// Palette is sky on white — matches the app's existing accents. The WitUS
// logomark is designed for dark backgrounds, so it sits inside a small dark
// chip on the light footer to stay legible.

import Image from "next/image";
import Link from "next/link";

interface SiblingProduct {
  name: string;
  href: string;
}

// Canonical sibling-product list — mirror of
// witus/public/brand/footer-recipe.md / witus/lib/products.ts.
const SIBLING_PRODUCTS: SiblingProduct[] = [
  { name: "WitUS.online", href: "https://witus.online" },
  { name: "WitUS Inbox", href: "https://inbox.witus.online" },
  { name: "CentenarianOS", href: "https://centenarianos.com" },
  { name: "Work.WitUS", href: "https://work.witus.online" },
  { name: "Tour Manager OS", href: "https://tour.witus.online" },
  { name: "Wanderlearn", href: "https://wanderlearn.witus.online" },
  { name: "Fly.WitUS", href: "https://fly.witus.online" },
  { name: "FlashLearnAI", href: "https://flashlearnai.witus.online" },
  { name: "AwesomeWebStore", href: "https://awesomewebstore.com" },
];

const linkClasses =
  "inline-flex items-center min-h-7 text-gray-600 hover:text-sky-700 hover:underline transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Product header — WitUS mark in a dark chip so the near-white mark
            stays visible on the light footer. */}
        <div className="flex flex-col items-center text-center mb-8">
          <span className="inline-flex items-center justify-center rounded-full bg-slate-900 p-2 mb-2">
            <Image
              src="/brand/witus/logomark.svg"
              alt="WitUS ecosystem"
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8"
            />
          </span>
          <p className="font-extrabold text-gray-900">Fit T. Cent 3.0</p>
          <p className="text-xs text-gray-600">Centenarian Coach Multi-Agent</p>
          <p className="text-xs text-gray-500">
            A multi-agent longevity coach: supervisor + specialist subgraphs.
            Get Fit and Learn Tryin&rsquo;
          </p>
        </div>

        <RiseWellnessCallout />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="text-gray-900 font-semibold mb-2">Ecosystem</p>
            <ul className="space-y-1">
              {SIBLING_PRODUCTS.map((p) => (
                <li key={p.href}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClasses}
                  >
                    {p.name}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-gray-900 font-semibold mb-2">Fit T. Cent 3.0</p>
            <ul className="space-y-1">
              <li><Link href="/" className={linkClasses}>Home</Link></li>
              <li><Link href="/walkthrough" className={linkClasses}>Walkthrough</Link></li>
              <li><Link href="/signin" className={linkClasses}>Sign in</Link></li>
              <li><Link href="/coach" className={linkClasses}>Coach</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-gray-900 font-semibold mb-2">Partners &amp; Legal</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://www.centenarianos.com/safety#rise-wellness"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClasses}
                >
                  Rise Wellness
                  <span className="sr-only"> (mental-health partner, opens in new tab)</span>
                </a>
                <p className="text-xs text-gray-400 leading-tight">Mental-health partner</p>
              </li>
              <li className="pt-2">
                <a href="https://witus.online/terms" target="_blank" rel="noopener noreferrer" className={linkClasses}>Terms</a>
              </li>
              <li>
                <a href="https://witus.online/privacy" target="_blank" rel="noopener noreferrer" className={linkClasses}>Privacy</a>
              </li>
              <li>
                <a href="mailto:bam@awews.com" className={linkClasses}>Contact</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-500 text-center">
          <p>
            © {year} B4C LLC, an{" "}
            <a
              href="https://awesomewebstore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-sky-700 hover:underline"
            >
              AwesomeWebStore.com
              <span className="sr-only"> (opens in new tab)</span>
            </a>{" "}
            brand
          </p>
        </div>
      </div>
    </footer>
  );
}

// Canonical Rise Wellness callout — verbatim from
// witus/public/brand/footer-recipe.md, [YOUR APP NAME] tokens replaced with
// "Centenarian Coach Multi-Agent". The disclaimer text is byte-identical
// across the ecosystem (vetted with the partner). Don't paraphrase, trim, or
// reorder it. The container className is the only permitted swap target.
function RiseWellnessCallout() {
  return (
    <section
      aria-labelledby="rise-wellness-heading"
      className="mb-8 rounded-lg border border-sky-200 bg-sky-50 p-5 text-sm"
    >
      <header className="mb-3">
        <p className="text-[11px] uppercase tracking-wide text-sky-700 font-semibold">
          Mental health support
        </p>
        <h2 id="rise-wellness-heading" className="text-base font-semibold text-gray-900">
          Rise Wellness of Indiana
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Independent mental health provider · Not affiliated with Centenarian Coach Multi-Agent
        </p>
      </header>

      <p className="text-gray-700 leading-relaxed">
        Rise Wellness of Indiana provides compassionate, personalized,
        holistic mental health care: evidence-based medicine, trauma-informed
        care, and a whole-person approach to help you heal, grow, and thrive
        in mind, body, and spirit.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Services</p>
          <ul className="text-xs text-gray-700 space-y-0.5">
            <li>ADHD testing &amp; management (in-person and from home)</li>
            <li>Anxiety &amp; depression</li>
            <li>Maternal mental health</li>
            <li>Medication management</li>
            <li>GeneSight® genetic testing</li>
            <li>Behavioral therapy &amp; coaching</li>
            <li>Routine lab testing</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Visit or call</p>
          <address className="not-italic text-xs text-gray-700 leading-relaxed">
            320 North Meridian Street<br />
            Indianapolis, IN 46204<br />
            Mon–Sat by appointment · Sun closed
          </address>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
            <a
              href="tel:+13179650299"
              className="inline-flex items-center min-h-7 font-medium text-sky-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded"
            >
              317-965-0299
            </a>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <a
              href="https://risewellnessofindiana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-7 font-medium text-sky-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded"
            >
              risewellnessofindiana.com
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <a
              href="https://www.centenarianos.com/safety#rise-wellness"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-7 font-medium text-sky-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded"
            >
              Full safety page
              <span className="sr-only"> on centenarianos.com (opens in new tab)</span>
            </a>
          </div>
        </div>
      </div>

      <blockquote className="mt-4 border-l-2 border-sky-300 pl-3 text-xs italic text-gray-600">
        &ldquo;At Rise Wellness, we believe everyone has the capacity to rise
        above challenges and live a fulfilling, healthy life. Our care is
        guided by the belief that healing is personal, holistic, and rooted
        in compassion.&rdquo;
        <span className="block not-italic mt-1 text-gray-500">
          Rise Wellness of Indiana
        </span>
      </blockquote>

      {/* === NON-NEGOTIABLE DISCLAIMER ===
          Edit ONLY the app name token. Don't paraphrase. Don't trim.
          Don't reorder. This was vetted with the partner. */}
      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
        Rise Wellness of Indiana is an independent organization. They are
        not affiliated with, employed by, or endorsed by Centenarian Coach
        Multi-Agent, CentenarianOS, B4C LLC, AwesomeWebStore.com, or Anthony
        McDonald. We are grateful for their collaboration on mental health
        safety resources for our community.
      </p>
    </section>
  );
}
