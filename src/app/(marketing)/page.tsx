import { FinalCta, SiteFooter } from "@/components/marketing/final-cta";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Security } from "@/components/marketing/security";
import { SiteHeader } from "@/components/marketing/site-header";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";
import { getUser } from "@/lib/data/session";

export default async function LandingPage() {
  const user = await getUser();

  return (
    <>
      <SmoothScroll />
      <SiteHeader signedIn={!!user} />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
