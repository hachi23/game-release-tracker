import { useEffect, useState } from "react";
import type { CompletedGameDetail } from "../../../../../shared/types";
import { igdbCoverSrc, screenshotSrc } from "../../../../frontend/src/artwork";
import type { AcademyContext } from "../AcademyApp";
import { ratingLabel, shortDate } from "../format";
import { Polaroid } from "../ui";

// A finished game's page: grade, finish date and notes are editable. A working page for now; its final
// design comes with the game-details concepts.

export function CompletedDetailView({ id, context }: { id: string; context: AcademyContext }) {
  const { api, fail, back, notify } = context;
  const [game, setGame] = useState<CompletedGameDetail | null>(null);
  const [form, setForm] = useState({ ratingRaw: "", completionDate: "", notes: "", userPlatform: "" });

  useEffect(() => {
    api.getCompletedGame(id).then(item => {
      setGame(item);
      setForm({ ratingRaw: item.ratingRaw ?? "", completionDate: item.completionDate ?? "", notes: item.notes ?? "", userPlatform: item.userPlatform });
    }).catch(fail);
  }, [api, id, fail]);

  const save = async () => {
    try {
      const { item } = await api.patchCompletedGame(id, { ratingRaw: form.ratingRaw || null, completionDate: form.completionDate || null, notes: form.notes || null, userPlatform: form.userPlatform });
      setGame(item);
      notify("Saved in your notebook.");
    } catch (error) {
      fail(error);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${game?.title} from your Completed Library?`)) return;
    try {
      await api.deleteCompletedGame(id);
      back();
    } catch (error) {
      fail(error);
    }
  };

  if (!game) return null;
  return (
    <article className="stack" style={{ gap: 16 }}>
      <button type="button" className="back" onClick={back} style={{ alignSelf: "flex-start" }}>‹ Back</button>
      <div className="two-pages">
        <div className="stack">
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 18 }}>
            <Polaroid src={game.coverImageId ? igdbCoverSrc(game.coverImageId, "detail") : null} alt={`${game.title} cover`} tilt={-2} tape grade={ratingLabel(game.ratingScore, game.ratingRaw)} width="40%" />
            <div className="stack" style={{ gap: 6, minWidth: 0, flex: 1 }}>
              <h1 className="display" style={{ margin: 0, fontSize: 26, lineHeight: 1.1, overflowWrap: "anywhere" }}>{game.title}</h1>
              <div className="muted">{[game.igdbDeveloper ?? game.developer, game.igdbPublisher ?? game.publisher].filter(Boolean).join(" · ")}</div>
              <div className="page-note">Finished {shortDate(game.completionDate) ?? game.completionMonth ?? game.completionYear ?? "–"} on {game.userPlatform}</div>
            </div>
          </div>
          {game.summary ? <p style={{ margin: 0 }}>{game.summary}</p> : null}
          {game.screenshots.length ? (
            <div className="scroller" aria-label="Screenshots">
              {game.screenshots.map((shot, index) => <Polaroid key={shot.imageId} src={screenshotSrc(shot.imageId)} wide tilt={index % 2 ? 1.5 : -1.5} width={220} />)}
            </div>
          ) : null}
        </div>
        <form className="stack" onSubmit={event => { event.preventDefault(); void save(); }}>
          <label className="field"><span>Your grade</span><input className="input" inputMode="decimal" value={form.ratingRaw} onChange={event => setForm({ ...form, ratingRaw: event.target.value })} placeholder="9.5" /></label>
          <label className="field"><span>Finished on</span><input className="input" type="date" value={form.completionDate} onChange={event => setForm({ ...form, completionDate: event.target.value })} /></label>
          <label className="field"><span>Played on</span><input className="input" value={form.userPlatform} onChange={event => setForm({ ...form, userPlatform: event.target.value })} /></label>
          <label className="field"><span>Notes</span><textarea className="input sticky" style={{ border: 0 }} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="row">
            <button type="submit" className="btn solid">Save</button>
            <button type="button" className="btn danger" onClick={() => void remove()}>Delete</button>
          </div>
        </form>
      </div>
    </article>
  );
}
