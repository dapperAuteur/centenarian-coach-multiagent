// src/components/Logo.tsx
// The app logo (the WitUS ship, ver2), served from Cloudinary (CDN-optimized;
// the host is allowlisted in next.config.ts). Links home. Size it with
// `className` (e.g. "h-9 w-auto"); the width/height props set the intrinsic
// aspect ratio of the source image (2412x1760) so it never distorts.

import Image from "next/image";
import Link from "next/link";

const LOGO_SRC =
  "https://res.cloudinary.com/devdash54321/image/upload/v1780581693/platypus-ship-witus-ver2_cawbok.png";

export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Fit T. Cent, home" className="inline-block">
      <Image
        src={LOGO_SRC}
        alt="Fit T. Cent"
        width={2412}
        height={1760}
        priority
        className={className}
      />
    </Link>
  );
}
