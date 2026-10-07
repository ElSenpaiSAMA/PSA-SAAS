import { ChartBackground } from "./chart-background";
import { HeroBoat } from "./hero-boat";

/** "Dentro de tu barco": el yate 3D sobre la carta náutica, justo debajo del hero. */
export function BoatStage() {
  return (
    <section className="relative isolate overflow-hidden pt-10 pb-20" aria-labelledby="boat-stage-title">
      <ChartBackground />
      <div className="mx-auto max-w-2xl px-6 text-center">
        <p className="text-[13px] font-medium text-blue-700">Dentro de tu barco</p>
        <h2 id="boat-stage-title" className="mt-2 text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-slate-950">
          Todo lo que no se ve, <span className="font-serif font-normal text-blue-700 italic">y hace que funcione.</span>
        </h2>
      </div>
      <div className="mx-auto mt-8 max-w-6xl px-6">
        <HeroBoat />
      </div>
    </section>
  );
}
