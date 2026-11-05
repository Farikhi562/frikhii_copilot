import { MotionConfig } from "motion/react";
import { FinalCta, LandingFooter } from "../features/landing/Closing";
import { FaqSection } from "../features/landing/FaqSection";
import { Hero } from "../features/landing/Hero";
import { LandingNav } from "../features/landing/LandingNav";
import {
  Architect,
  HowItWorks,
  Problem,
  Showcase,
  Solution,
  Tutor,
  WhyFrikhii,
} from "../features/landing/StorySections";
import { Trailer } from "../features/landing/Trailer";

/**
 * Public landing page. Section order is the product story:
 * nav, hero, trailer, problem, solution, Course Architect, AI Tutor,
 * product interface, how it works, why FRIKHII, FAQ, final CTA, footer.
 * Every demo or planned feature on this page is labelled as such.
 */
export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <LandingNav />
      <main id="top">
        <Hero />
        <Trailer />
        <Problem />
        <Solution />
        <Architect />
        <Tutor />
        <Showcase />
        <HowItWorks />
        <WhyFrikhii />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </MotionConfig>
  );
}
