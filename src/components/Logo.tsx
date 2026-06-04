// src/components/Logo.tsx
// The app logo (the WitUS ship, ver2). Links home. Size it with `className`
// (e.g. "h-9 w-auto"); the width/height props set the intrinsic aspect ratio of
// the source image (2412x1760) so it never distorts.

import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Fit T. Cent, home" className="inline-block">
      <Image
        src="/platypus-ship-witus-ver2.png"
        alt="Fit T. Cent"
        width={2412}
        height={1760}
        priority
        className={className}
      />
    </Link>
  );
}
