import { useState } from "react";
import { Play } from "lucide-react";
import { assets } from "../../lib/assets";
import { Eyebrow, H2, Section } from "./primitives";

const isEmbed = (url: string) => /youtube\.com|youtu\.be|vimeo\.com/.test(url);

/**
 * 16:9 trailer. Nothing loads until the visitor presses play (no autoplay, preload="none").
 * With no videoUrl configured it shows an honest "coming soon" panel instead of a dead player.
 */
export function Trailer() {
  const { videoUrl, posterUrl, title, description } = assets.trailer;
  const [playing, setPlaying] = useState(false);
  const hasVideo = Boolean(videoUrl);

  return (
    <Section id="trailer" tone="ink" labelledBy="trailer-heading">
      <Eyebrow onDark>Product trailer</Eyebrow>
      <H2 id="trailer-heading" className="mt-4 max-w-3xl">Meet your new learning companion.</H2>
      <div className="mt-10">
        <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-paper/15 bg-paper/5">
          {hasVideo && playing ? (
            isEmbed(videoUrl) ? (
              <iframe src={videoUrl} title={title} loading="lazy" allow="fullscreen" className="absolute inset-0 h-full w-full" />
            ) : (
              <video src={videoUrl} poster={posterUrl || undefined} controls autoPlay playsInline preload="none" className="absolute inset-0 h-full w-full" />
            )
          ) : (
            <>
              {posterUrl && <img src={posterUrl} alt="" width={1280} height={720} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
              {hasVideo ? (
                <button type="button" onClick={() => setPlaying(true)} aria-label={`Play: ${title}`} className="absolute inset-0 grid place-items-center">
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-lime text-ink transition hover:scale-105">
                    <Play fill="currentColor" aria-hidden />
                  </span>
                </button>
              ) : (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  <div>
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-dashed border-paper/40 text-paper/60">
                      <Play aria-hidden />
                    </span>
                    <p className="mt-4 font-mono text-sm text-paper/70">Trailer coming soon</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="mt-5 max-w-2xl">
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-paper/70">{description}</p>
        </div>
      </div>
    </Section>
  );
}
