import { useEffect, useState } from "react";
import type { ReleaseDetail } from "../../../../../shared/types";
import { screenshotSrc } from "../../../../frontend/src/artwork";
import { youtubeEmbedSrc, youtubePosterSrc } from "../../../../frontend/src/youtube";
import type { AcademyContext } from "../AcademyApp";
import { circledCountdown, longDate } from "../format";
import { Circled, Icon, Polaroid, coverOf } from "../ui";

// A release's page. A working page for now: its final Academy design is chosen from the concept
// artifacts. Trailer playback mounts only after Play, and leaving the page unmounts it.

export function ReleaseDetailView({ id, context }: { id: string; context: AcademyContext }) {
  const { api, today, fail, back } = context;
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.getRelease(id).then(setRelease).catch(() => setMissing(true));
  }, [api, id]);

  const patch = async (payload: Record<string, unknown>) => {
    try {
      setRelease((await api.patchRelease(id, payload)).item);
    } catch (error) {
      fail(error);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${release?.title} from Upcoming? A sync may add it again; use Hide to keep it out.`)) return;
    try {
      await api.deleteRelease(id);
      back();
    } catch (error) {
      fail(error);
    }
  };

  if (missing) return <><button type="button" className="back" onClick={back}>‹ Back</button><p className="page-note">This game isn't in Upcoming any more.</p></>;
  if (!release) return null;
  const trailer = release.trailers[0];

  return (
    <article className="stack" style={{ gap: 16 }}>
      <button type="button" className="back" onClick={back} style={{ alignSelf: "flex-start" }}>‹ Back</button>
      <div className="two-pages">
        <div className="stack">
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 18 }}>
            <Polaroid src={coverOf(release.artworks, "detail")} alt={`${release.title} cover`} tilt={-2} tape width="40%" />
            <div className="stack" style={{ gap: 8, minWidth: 0, flex: 1 }}>
              <span className="tag" style={{ alignSelf: "flex-start" }}>{release.category}</span>
              <h1 className="display" style={{ margin: 0, fontSize: 28, lineHeight: 1.08, overflowWrap: "anywhere" }}>{release.title}</h1>
              <div className="muted">{[release.publishers.join(", "), release.developers.join(", ")].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 16 }}>
            <Circled>{circledCountdown(release, today)}</Circled>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{longDate(release.releaseDate) ?? release.dateText}</div>
              <div className="muted">{release.platforms.join(" · ")}</div>
            </div>
          </div>
          {release.genres.length ? <div className="chips">{release.genres.map(genre => <span key={genre} className="tag">{genre}</span>)}</div> : null}
          <div className="row">
            <button type="button" className="btn solid" onClick={() => void patch({ watched: !release.watched })}>{release.watched ? "★ Watching" : "☆ Watch"}</button>
            <button type="button" className="btn" onClick={() => void patch({ hidden: !release.hidden })}>{release.hidden ? "Show again" : "Hide"}</button>
            <button type="button" className="btn danger" onClick={() => void remove()}>Delete</button>
          </div>
        </div>

        <div className="stack">
          {trailer ? (
            <figure className="polaroid wide" style={{ margin: 0, transform: "rotate(1deg)" }}>
              {playing ? (
                <iframe
                  title={trailer.name ?? `${release.title} trailer`}
                  src={youtubeEmbedSrc(trailer.videoId)}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ width: "100%", aspectRatio: "16 / 9", border: 0, display: "block" }}
                />
              ) : (
                <button type="button" onClick={() => setPlaying(true)} aria-label="Play trailer" style={{ position: "relative", display: "block", width: "100%", padding: 0, border: 0, background: "none", cursor: "pointer" }}>
                  <img src={youtubePosterSrc(trailer.videoId)} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} />
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}>
                    <span style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(176,60,52,.9)", display: "grid", placeItems: "center" }}><Icon name="play" size={28} /></span>
                  </span>
                </button>
              )}
              <figcaption className="caption">{trailer.name ?? "Trailer"}</figcaption>
            </figure>
          ) : null}
          {release.screenshots.length ? (
            <div className="scroller" aria-label="Screenshots">
              {release.screenshots.map((shot, index) => (
                <Polaroid key={shot.imageId} src={screenshotSrc(shot.imageId)} wide tilt={index % 2 ? 1.5 : -1.5} width={220} />
              ))}
            </div>
          ) : null}
          {release.dateChanges?.length ? (
            <div className="sheet">
              <h2 className="hand" style={{ margin: 0, fontSize: 24, color: "var(--blue)" }}>Date history</h2>
              {release.dateChanges.map(change => (
                <div key={change.changedAt + change.toText} style={{ padding: "6px 0", borderBottom: "1px solid var(--rule)" }}>
                  <b style={{ textTransform: "capitalize" }}>{change.kind}</b>: {change.fromText} → {change.toText}
                </div>
              ))}
            </div>
          ) : null}
          {release.igdbUrl ? <a href={release.igdbUrl} target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>Open on IGDB</a> : null}
        </div>
      </div>
    </article>
  );
}
