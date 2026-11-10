import { useEffect, useState } from "react";
import type { ReleaseDetail } from "../../../../../shared/types";
import { screenshotSrc } from "../../../../frontend/src/artwork";
import { youtubeEmbedSrc, youtubePosterSrc } from "../../../../frontend/src/youtube";
import type { AcademyContext } from "../AcademyApp";
import { countdown, longDate, monthName, parseDay } from "../format";
import { coverOf, Icon } from "../ui";

// An upcoming game's page: the Spellbook Entry design. The cover sits in an arched window, the title
// opens with an illuminated capital, a ring of fourteen moons counts down the last two weeks, and the
// wax seal watches the game. The trailer mounts only after Play and unmounts when the page closes.

const MOONS = 14;

export function ReleaseDetailView({ id, context }: { id: string; context: AcademyContext }) {
  const { api, today, fail, back } = context;
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shot, setShot] = useState(0);

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

  const { days } = countdown(release, today);
  const day = release.datePrecision === "Exact" ? parseDay(release.releaseDate) : null;
  const chapter = day ? `Chapter of ${monthName(day.getMonth() + 1)}` : `Chapter of ${release.dateText || "the unknown"}`;
  const house = release.publishers[0] ?? release.developers[0];
  const [initial, rest] = [release.title.slice(0, 1), release.title.slice(1)];
  const trailer = release.trailers[0];
  const shots = release.screenshots;
  const latestChange = release.dateChanges?.[0];

  const castLine = days === null ? `Arrives ${release.dateText || "on a date not yet known"}` : days < 0 ? "Out now" : days === 0 ? "Cast tonight" : days === 1 ? "One night until it's cast" : `${days} nights until it's cast`;

  return (
    <article className="spellbook">
      <button type="button" className="back" onClick={back} style={{ alignSelf: "flex-start" }}>‹ Back</button>
      <div className="spellbook-frame">
        <div className="arch">
          {coverOf(release.artworks, "detail") ? <img src={coverOf(release.artworks, "detail")!} alt={`${release.title} cover`} /> : <div className="blank" aria-hidden="true" />}
        </div>

        <div className="chapter-line">{[chapter, house].filter(Boolean).join(" · ")}</div>

        <div className="illuminated">
          <span className="capital" aria-hidden="true">{initial}</span>
          <h1 aria-label={release.title}><span aria-hidden="true">{rest}</span></h1>
        </div>

        <div className="moon-card">
          <MoonRing days={days} />
          <div className="stack" style={{ gap: 2 }}>
            <span className="hand" style={{ fontSize: 24, lineHeight: 1.1, color: "var(--red)" }}>{castLine}</span>
            <span style={{ fontWeight: 700 }}>{longDate(release.releaseDate) ?? release.dateText}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {latestChange
                ? `${latestChange.kind === "delayed" ? "Delayed" : latestChange.kind === "earlier" ? "Moved up" : "Dated"} from ${latestChange.fromText}`
                : release.watched ? "No delays recorded since you started watching" : "No date changes recorded"}
            </span>
          </div>
        </div>

        <section className="stack" style={{ gap: 8 }} aria-label="Platforms and genres">
          <h2 className="hand spell-heading">Appears in these circles</h2>
          <div className="chips">
            {release.platforms.map(platform => (
              <span key={platform} className="circle-chip">
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0 L10 5 L5 10 L0 5 Z" fill="currentColor" /></svg>
                {platform}
              </span>
            ))}
          </div>
          <div className="chips">
            {[release.category, ...release.genres].map(tag => <span key={tag} className="tag">{tag}</span>)}
          </div>
        </section>

        {trailer ? (
          <section aria-label="Trailer" className="stack" style={{ gap: 10 }}>
            {playing ? (
              <>
                <h2 className="hand spell-heading">Scrying glass</h2>
                <iframe
                  className="scrying-player"
                  title={trailer.name ?? `${release.title} trailer`}
                  src={youtubeEmbedSrc(trailer.videoId)}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
                <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setPlaying(false)}>Close the glass</button>
              </>
            ) : (
              <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}>
                <div className="scrying">
                  <img src={youtubePosterSrc(trailer.videoId)} alt="" />
                  <button type="button" aria-label="Play the trailer" onClick={() => setPlaying(true)}><Icon name="play" size={22} /></button>
                </div>
                <div>
                  <h2 className="hand spell-heading">Scrying glass</h2>
                  <p className="muted" style={{ margin: 0 }}>{trailer.name ?? "Trailer"}. Plays in the glass; leave the page and it stops.</p>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {shots.length ? (
          <section aria-label="Screenshots" className="stack" style={{ gap: 8 }}>
            <h2 className="hand spell-heading">Illustrations</h2>
            <img className="illustration" src={screenshotSrc(shots[Math.min(shot, shots.length - 1)].imageId, "hero")} alt="Selected screenshot" />
            <div className="illustration-thumbs">
              {shots.slice(0, 6).map((item, index) => (
                <button key={item.imageId} type="button" aria-label={`Show screenshot ${index + 1}`} aria-pressed={index === shot} onClick={() => setShot(index)}>
                  <img src={screenshotSrc(item.imageId)} alt="" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}>
          <button type="button" className="wax-seal" aria-pressed={Boolean(release.watched)} onClick={() => void patch({ watched: !release.watched })}>
            {release.watched ? "Sealed" : "Seal it"}
          </button>
          <span className="hand" style={{ fontSize: 20, lineHeight: 1.2, color: "var(--ink-muted)" }}>
            {release.watched ? "Watching. You'll be told if the date moves or when it's out." : "Seal it to watch for delays and the release day."}
          </span>
        </div>
        <div className="row">
          <button type="button" className="btn small" onClick={() => void patch({ hidden: !release.hidden })}>{release.hidden ? "Show again" : "Hide"}</button>
          <button type="button" className="btn small danger" onClick={() => void remove()}>Delete</button>
          {release.igdbUrl ? <a href={release.igdbUrl} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", alignSelf: "center" }}>Open on IGDB</a> : null}
        </div>
      </div>
    </article>
  );
}

// Fourteen moons for the last two weeks: the nights still to go glow red; further out, the count sits
// in the middle of an unlit ring.
function MoonRing({ days }: { days: number | null }) {
  const lit = days === null || days < 0 ? 0 : Math.min(days, MOONS);
  const label = days === null ? "?" : days < 0 ? "✓" : String(days);
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={days === null ? "Date not known yet" : days < 0 ? "Already out" : `${days} nights to go`} style={{ flex: "none" }}>
      <circle cx="48" cy="48" r="40" fill="none" stroke="var(--rule)" strokeWidth="2" />
      {Array.from({ length: MOONS }, (_, index) => {
        const angle = (index / MOONS) * Math.PI * 2 - Math.PI / 2;
        const on = index >= MOONS - lit;
        return <circle key={index} cx={48 + Math.cos(angle) * 40} cy={48 + Math.sin(angle) * 40} r="5" fill={on ? "var(--red)" : "var(--sheet)"} stroke="var(--gold-strong)" strokeWidth="1" />;
      })}
      <text x="48" y="55" textAnchor="middle" style={{ font: "700 26px Caveat, cursive" }} fill="var(--red)">{label}</text>
    </svg>
  );
}
