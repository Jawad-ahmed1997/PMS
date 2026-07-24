"use client";

import Image from "next/image";
import { useTheme } from "@/lib/theme";

const LOGOS = {
  light: { src: "/NewLogo.webp", width: 236, height: 64 },
  dark: { src: "/NewLogo_white_text.png", width: 2172, height: 724 },
};

export default function Logo({ alt = "PMS Cloud", priority = false, className = "" }) {
  const { resolvedTheme } = useTheme();
  const logo = LOGOS[resolvedTheme] ?? LOGOS.light;

  return <Image key={logo.src} src={logo.src} alt={alt} width={logo.width} height={logo.height} priority={priority} className={className} />;
}
