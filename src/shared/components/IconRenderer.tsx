"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";

type IconMap = Record<string, ComponentType<IconProps>>;

// Icon names come from the database, so they can't be a static allowlist. Importing the whole
// namespace statically would put every Phosphor icon in the main client bundle; a dynamic import
// moves them into a separate chunk that loads once, only when an icon is actually rendered.
let icons: IconMap | null = null;
let pending: Promise<IconMap> | null = null;

function loadIcons(): Promise<IconMap> {
  pending ??= import("@phosphor-icons/react").then((mod) => (icons = mod as unknown as IconMap));
  return pending;
}

interface IconRendererProps {
  name: string;
  size?: number;
  className?: string;
  weight?: IconProps["weight"];
}

export default function IconRenderer({ name, size = 20, className = "", weight = "bold" }: IconRendererProps) {
  const [Icon, setIcon] = useState<ComponentType<IconProps> | null>(() => icons?.[name] ?? null);

  useEffect(() => {
    let active = true;
    loadIcons().then((all) => {
      if (active) setIcon(() => all[name] ?? null);
    });
    return () => {
      active = false;
    };
  }, [name]);

  if (!Icon) return <span aria-hidden style={{ width: size, height: size, display: "inline-block" }} />;
  return <Icon size={size} className={className} weight={weight} />;
}
