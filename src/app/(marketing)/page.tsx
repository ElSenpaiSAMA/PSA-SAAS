import { BoatStage } from "@/components/marketing/boat-stage";
import { Company } from "@/components/marketing/company";
import { FinalCta, SiteFooter } from "@/components/marketing/final-cta";
import { Gallery } from "@/components/marketing/gallery";
import { Hero } from "@/components/marketing/hero";
import { Process } from "@/components/marketing/process";
import { Services } from "@/components/marketing/services";
import { SiteHeader } from "@/components/marketing/site-header";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";
import { getUser } from "@/lib/data/session";

export default async function LandingPage() {
  const user = await getUser();

  return (
    <>
      <SmoothScroll />
      <SiteHeader signedIn={!!user} overDark />
      <main className="bg-white">
        <Hero />
        <BoatStage />
        <Services />
        <Company />
        <Gallery />
        <Process />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
