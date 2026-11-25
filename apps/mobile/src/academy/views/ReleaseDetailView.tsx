import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReleaseDetail } from "../../../../../shared/types";
import { screenshotSrc } from "../../../../frontend/src/artwork";
import { youtubeEmbedSrc, youtubePosterSrc } from "../../../../frontend/src/youtube";
import type { AcademyContext } from "../AcademyApp";
import { coverTintStyle, useCoverPalette, type DetailBgTint } from "../coverPalette";
import { countdown, longDate } from "../format";
import { invalidateUpcomingCache } from "../listCache";
import { coverOf, Icon } from "../ui";

// Upcoming game detail page: cover-tinted frosted glass (40% / 60% / 70%) with harmonized cards,
// big rectangular cover (no arch, no candles/moon ring), clean countdown + Watch bar, and a
// full-width 16:9 rectangular Trailer + Screenshots gallery with tap-to-fullscreen lightbox.

const TINTS: DetailBgTint[] = ["40", "60", "70"];

type MediaSlide =
  | { kind: "trailer"; videoId: string; label: string }
  | { kind: "screenshot"; imageId: string; label: string };

export function ReleaseDetailView({ id, context }: { id: string; context: AcademyContext }) {
  const { api, today, fail, back, detailTint, setDetailTint } = context;
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    setActiveSlide(0);
    setPlayingTrailer(false);
    setLightbox(false);
    api.getRelease(id).then(setRelease).catch(() => setMissing(true));
  }, [api, id]);

  const coverUrl = release ? coverOf(release.artworks, "detail") : null;
  const palette = useCoverPalette(coverUrl);

  const patch = async (payload: Record<string, unknown>) => {
    try {
      setRelease((await api.patchRelease(id, payload)).item);
      invalidateUpcomingCache();
    } catch (error) {
      fail(error);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${release?.title} from Upcoming? A sync may add it again; use Hide to keep it out.`)) return;
    try {
      await api.deleteRelease(id);
      invalidateUpcomingCache();
      back();
    } catch (error) {
      fail(error);
    }
  };

  if (missing) {
    return (
      <div className="detail-glass" data-tint={detailTint}>
        <button type="button" className="back detail-pill" style={{ alignSelf: "flex-start" }} onClick={back}>‹ Back</button>
        <p className="page-note">This game isn't in Upcoming any more.</p>
      </div>
    );
  }
  if (!release) return null;

  const { label: countdownLabel, days } = countdown(release, today);
  const studio = [...release.developers, ...release.publishers].filter(Boolean);
  const latestChange = release.dateChanges?.[0];
  const slides: MediaSlide[] = [
    ...release.trailers.map(trailer => ({
      kind: "trailer" as const,
      videoId: trailer.videoId,
      label: trailer.name?.trim() || "Trailer"
    })),
    ...release.screenshots.slice(0, 10).map((shot, idx) => ({
      kind: "screenshot" as const,
      imageId: shot.imageId,
      label: `Screenshot ${idx + 1}`
    }))
  ];
  const currentSlide = slides[Math.min(activeSlide, Math.max(0, slides.length - 1))] ?? null;

  const selectSlide = (index: number) => {
    setActiveSlide(index);
    setPlayingTrailer(false);
  };

  const coverSection = (
    <div className="m-spell-hero">
      <figure className="m-rect-cover">
        {coverUrl ? <img src={coverUrl} alt={`${release.title} cover`} /> : <div className="blank" aria-hidden="true" />}
      </figure>

      <div className="detail-card stack" style={{ gap: 8 }}>
        <div className="chips">
          <span className="tag">{release.category}</span>
          {release.genres.slice(0, 3).map(genre => <span key={genre} className="tag">{genre}</span>)}
        </div>
        <h1 className="m-spell-title">{release.title}</h1>
        {studio.length ? <div className="m-spell-meta">{[...new Set(studio)].slice(0, 2).join(" · ")}</div> : null}
      </div>
    </div>
  );

  const infoSection = (
    <div className="stack" style={{ gap: 12 }}>
      <section className="detail-card m-countdown-bar" aria-label="Release date and watchlist">
        <div className="stack" style={{ gap: 3 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className={`m-countdown-pill${days !== null && days <= 14 ? "" : " m-countdown-pill--muted"}`}>
              {days === null ? release.dateText || "TBA" : days < 0 ? "Out now" : days === 0 ? "Out today!" : countdownLabel}
            </span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{longDate(release.releaseDate) ?? release.dateText}</span>
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {latestChange
              ? `${latestChange.kind === "delayed" ? "Delayed" : latestChange.kind === "earlier" ? "Moved up" : "Dated"} from ${latestChange.fromText}`
              : release.watched ? "Watching for release day & date changes" : "Tap Watch for release-day alerts"}
          </span>
        </div>
        <button
          type="button"
          className={`btn small${release.watched ? " solid" : ""}`}
          aria-pressed={Boolean(release.watched)}
          onClick={() => void patch({ watched: !release.watched })}
        >
          {release.watched ? "★ Watching" : "☆ Watch"}
        </button>
      </section>

      {slides.length && currentSlide ? (
        <section className="m-media" aria-label="Trailer and screenshots">
          <div className="m-media__hero">
            {currentSlide.kind === "trailer" ? (
              playingTrailer ? (
                <iframe
                  title={currentSlide.label}
                  src={youtubeEmbedSrc(currentSlide.videoId)}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <>
                  <img src={youtubePosterSrc(currentSlide.videoId)} alt={currentSlide.label} />
                  <button type="button" className="m-media__play" aria-label="Play trailer" onClick={() => setPlayingTrailer(true)}>
                    <Icon name="play" size={24} />
                  </button>
                  <span className="m-media__badge">{currentSlide.label}</span>
                </>
              )
            ) : (
              <>
                <img
                  src={screenshotSrc(currentSlide.imageId, "hero")}
                  alt={`${release.title} ${currentSlide.label}`}
                  onClick={() => setLightbox(true)}
                  style={{ cursor: "zoom-in" }}
                />
                <span className="m-media__badge">{currentSlide.label}</span>
                <button type="button" className="m-media__fs" onClick={() => setLightbox(true)}>Fullscreen</button>
              </>
            )}
          </div>

          {slides.length > 1 ? (
            <div className="m-media__thumbs">
              {slides.map((slide, index) => (
                <button
                  key={slide.kind === "trailer" ? `tr-${slide.videoId}` : `sc-${slide.imageId}`}
                  type="button"
                  className="m-media__thumb"
                  aria-label={slide.label}
                  aria-pressed={index === activeSlide}
                  onClick={() => selectSlide(index)}
                >
                  <img
                    src={slide.kind === "trailer" ? youtubePosterSrc(slide.videoId) : screenshotSrc(slide.imageId)}
                    alt=""
                    loading="lazy"
                  />
                  {slide.kind === "trailer" ? <span className="m-media__thumb-tag">Trailer</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {release.platforms.length ? (
        <section className="detail-card stack" style={{ gap: 8 }} aria-label="Platforms">
          <span className="m-cork-label" style={{ margin: 0 }}>Platforms</span>
          <div className="chips">
            {release.platforms.map(platform => <span key={platform} className="tag">{platform}</span>)}
          </div>
        </section>
      ) : null}

      {release.dateChanges?.length ? (
        <section className="detail-card stack" style={{ gap: 6 }} aria-label="Date history">
          <span className="m-cork-label" style={{ margin: 0 }}>Date history</span>
          {release.dateChanges.map((change, idx) => (
            <div key={idx} className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
              <span>{change.fromText} → <b>{change.toText}</b></span>
              <span className="muted" style={{ textTransform: "capitalize" }}>{change.kind}</span>
            </div>
          ))}
        </section>
      ) : null}

      <div className="row">
        <button type="button" className="btn small detail-pill" onClick={() => void patch({ hidden: !release.hidden })}>
          {release.hidden ? "Show again" : "Hide"}
        </button>
        <button type="button" className="btn small danger detail-pill" onClick={() => void remove()}>Delete</button>
        {release.igdbUrl ? (
          <a href={release.igdbUrl} target="_blank" rel="noreferrer" className="btn small detail-pill" style={{ textDecoration: "none", color: "var(--blue)" }}>
            Open on IGDB ↗
          </a>
        ) : null}
      </div>
    </div>
  );

  return (
    <article className="detail-glass" data-tint={detailTint} style={coverTintStyle(palette)}>
      <div className="detail-topbar">
        <button type="button" className="back detail-pill" onClick={back}>‹ Back</button>
        <div className="detail-pill detail-tint" role="group" aria-label="Cover tint strength">
          <span>Tint</span>
          {TINTS.map(value => (
            <button key={value} type="button" aria-pressed={detailTint === value} onClick={() => setDetailTint(value)}>
              {value}%
            </button>
          ))}
        </div>
      </div>

      <div className="m-spell-layout">
        {coverSection}
        {infoSection}
      </div>

      {lightbox && currentSlide?.kind === "screenshot" ? createPortal(
        <div className="m-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer" onClick={() => setLightbox(false)}>
          <img src={screenshotSrc(currentSlide.imageId, "hero")} alt={currentSlide.label} onClick={event => event.stopPropagation()} />
          <button type="button" className="btn small" style={{ color: "#fff", borderColor: "var(--gold)" }} onClick={() => setLightbox(false)}>Close</button>
        </div>,
        document.body
      ) : null}
    </article>
  );
}
