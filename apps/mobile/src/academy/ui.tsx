import type { ReactNode } from "react";
import { igdbCoverSrc } from "../../../frontend/src/artwork";
import type { ReleaseArtwork } from "../../../../shared/types";

// Small pieces of the Academy notebook shared by the screens.

export function Crest() {
  return (
    <svg width="30" height="36" viewBox="0 0 30 36" aria-hidden="true">
      <path d="M15 1 L29 6 V17 C29 26 22 32 15 35 C8 32 1 26 1 17 V6 Z" fill="var(--ribbon-1)" stroke="var(--gold)" strokeWidth="1.5" />
      <path d="M9 12 H21 M9 17 H21 M9 22 H17" stroke="var(--gold)" strokeWidth="1.5" />
    </svg>
  );
}

// A cover (or screenshot) taped into the notebook. Tilt in degrees.
export function Polaroid({ src, alt = "", caption, tilt = 0, tape = false, grade, wide = false, width }: {
  src?: string | null;
  alt?: string;
  caption?: string;
  tilt?: number;
  tape?: boolean;
  grade?: string | null;
  wide?: boolean;
  width?: number | string;
}) {
  return (
    <figure className={`polaroid${wide ? " wide" : ""}`} style={{ transform: `rotate(${tilt}deg)`, width, margin: 0 }}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : <div className="blank" aria-hidden="true" />}
      {tape ? <span className="tape" aria-hidden="true" /> : null}
      {grade ? <span className="grade" aria-label={`Rated ${grade}`}>{grade}</span> : null}
      {caption ? <figcaption className="caption">{caption}</figcaption> : null}
    </figure>
  );
}

export function Circled({ children }: { children: ReactNode }) {
  return (
    <span className="circled">
      <svg viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true">
        <path d="M14 40 C10 12 100 4 108 34 C116 66 22 78 12 46 C8 30 40 14 70 16" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </span>
  );
}

export const coverOf = (artworks: ReleaseArtwork[], size: "big" | "detail" = "big") => {
  const cover = artworks.find(artwork => artwork.source === "cover") ?? artworks[0];
  if (!cover) return null;
  if ((cover.source === "steamgriddb" || cover.source === "local") && cover.url) return cover.url;
  return igdbCoverSrc(cover.imageId, size);
};

// Small stroke icons for the ribbons and buttons.
const paths: Record<string, string> = {
  upcoming: "M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4",
  calendar: "M3 5h18v16H3z M3 10h18 M8 14h2 M14 14h2 M8 18h2",
  library: "M4 4h4v16H4z M10 4h4v16h-4z M16 5l4 1-3 15-4-1z",
  spin: "M12 3a9 9 0 1 0 9 9 M21 3v6h-6",
  year: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  star: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z",
  search: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M15 15l5 5",
  plus: "M12 5v14 M5 12h14",
  play: "M8 5l11 7-11 7z"
};

export function Icon({ name, size = 20 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? ""} />
    </svg>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}
