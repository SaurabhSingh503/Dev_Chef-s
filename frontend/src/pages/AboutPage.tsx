import React, { useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';

function useIntersectionObserver(options = { threshold: 0.1 }) {
  const elementsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, options);

    elementsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [options]);

  const setRef = (index: number) => (el: HTMLElement | null) => {
    if (el) elementsRef.current[index] = el;
  };

  return setRef;
}

export function AboutPage({ go }: { go: (to: string) => void }) {
  const setRef = useIntersectionObserver();

  return (
    <div className="about-page consumer-services-page">
      {/* 1. HERO SECTION */}
      <section className="cs-hero" ref={setRef(0)}>
        <p className="eyebrow">HOW IT WORKS</p>
        <h1>From question to clarity.</h1>
        <p className="hero-copy">
          See how MANAK connects questions, standards, AI intelligence, and supporting information to help turn complex standards information into something easier to understand.
        </p>
      </section>

      {/* 2. HOW MANAK WORKS (THE WORKFLOW) */}
      <section className="cs-section" ref={setRef(1)}>
        <p className="eyebrow">THE WORKFLOW</p>
        <h2>What happens when you use MANAK?</h2>
        <div className="cs-journey">
          {[
            ['ASK', 'The user starts with a question, such as "What standard applies to this product?"'],
            ['DISCOVER', 'The system searches its standards knowledge base to identify relevant standards and supporting document content.'],
            ['UNDERSTAND', 'The retrieved information is processed, and AI Intelligence helps explain technical content in a more understandable form.'],
            ['VERIFY', 'The user can inspect the supporting sources and open the original BIS PDF documents to verify important information.'],
            ['ACT', 'The user can use the information to decide what to explore next, investigate requirements, or continue researching.']
          ].map(([title, desc]) => (
            <div key={title} className="cs-journey-step">
              <div className="step-num" style={{ padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '2px solid var(--primary)', overflow: 'hidden' }}>
                <img src={`/images/journey/${title}.png`} alt={title} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.5)' }} />
              </div>
              <div className="step-content">
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. THE MANAK PIPELINE */}
      <section className="cs-section cs-bg-light" ref={setRef(2)}>
        <p className="eyebrow">ONE CONNECTED SYSTEM</p>
        <h2>The MANAK Pipeline.</h2>
        <p className="cs-intro">
          MANAK uses a structured pipeline to turn your question into a verifiable answer without hiding the original sources.
        </p>
        <div className="feature-grid three-col">
          <div className="interactive-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3>USER QUESTION</h3>
            <p>You ask a question in natural language.</p>
          </div>
          <div className="interactive-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3>AI INTELLIGENCE</h3>
            <p>Understands the user's question and helps formulate useful answers.</p>
          </div>
          <div className="interactive-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3>STANDARDS KNOWLEDGE</h3>
            <p>Provides the relevant standards knowledge.</p>
          </div>
          <div className="interactive-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3>SOURCE DOCUMENTS</h3>
            <p>Contains the underlying BIS documents used as supporting information.</p>
          </div>
          <div className="interactive-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3>CITATIONS</h3>
            <p>Connect answers back to their supporting sources.</p>
          </div>
          <div className="interactive-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3>USER VERIFICATION</h3>
            <p>Allows the user to inspect the original document rather than blindly trusting an AI response.</p>
          </div>
        </div>
      </section>

      {/* 4. SOURCE VERIFICATION */}
      <section className="cs-section" ref={setRef(3)}>
        <p className="eyebrow">VERIFICATION</p>
        <h2>Don't just take the answer. Check the source.</h2>
        <p className="cs-intro">
          MANAK provides citations and allows users to open the original PDF source. This is one of the strongest differentiators of the platform.
        </p>
        <div className="cs-journey no-line" style={{ marginTop: '2rem' }}>
          {[
            ['AI ANSWER', 'The synthesized explanation based on standards knowledge.'],
            ['CITATION', 'A clickable reference indicating exactly where the information came from.'],
            ['ORIGINAL BIS PDF', 'The official document opens to the exact relevant page or section.'],
            ['USER VERIFICATION', 'You confirm the requirement firsthand before taking action.']
          ].map(([title, desc]) => (
            <div key={title} className="cs-journey-step" style={{ width: '25%', paddingTop: 0 }}>
              <div className="step-content">
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. DIFFERENT MANAK MODULES */}
      <section className="cs-section cs-bg-light" ref={setRef(4)}>
        <p className="eyebrow">MODULES</p>
        <h2>How the major modules fit into the workflow.</h2>
        <div className="feature-grid two-col">
          <div style={{ padding: '1.5rem' }}>
            <h3>STANDARDS</h3>
            <p>The core standards knowledge base.</p>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <h3>AI INTELLIGENCE</h3>
            <p>The conversational interface for exploring standards information.</p>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <h3>HANDBOOKS</h3>
            <p>Allows organizations to combine selected standards information into a consolidated handout.</p>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <h3>TESTING LABORATORIES</h3>
            <p>Helps organizations find relevant testing laboratory information.</p>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <h3>CONSUMER SERVICES</h3>
            <p>Provides a consumer-focused way to explore standards information.</p>
          </div>
        </div>
      </section>

      {/* 6. WHAT MANAK DOES NOT DO */}
      <section className="cs-section" ref={setRef(5)}>
        <p className="eyebrow">BOUNDARIES</p>
        <h2>What MANAK does not do.</h2>
        <p className="cs-intro">
          MANAK helps users discover and understand information, but it is not a regulatory authority.
        </p>
        <ul style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left', lineHeight: '1.8', color: 'var(--muted)', fontSize: '1.1rem' }}>
          <li>MANAK does not certify products.</li>
          <li>MANAK does not approve products.</li>
          <li>MANAK does not guarantee compliance.</li>
          <li>MANAK does not replace official BIS procedures.</li>
          <li>MANAK does not replace professional/legal advice.</li>
          <li>MANAK does not guarantee that an AI-generated explanation is correct.</li>
        </ul>
      </section>

      {/* 7. FINAL CTA */}
      <section className="cs-section cs-cta-section" ref={setRef(6)}>
        <p className="eyebrow">START EXPLORING</p>
        <h2>Start with a question.</h2>
        <p className="cs-intro">
          Explore the standards behind the answer and verify the information using the original source.
        </p>
        <div className="actions">
          <Button onClick={() => go('/standards')}>Explore standards →</Button>
          <Button variant="secondary" onClick={() => go('/ai-intelligence')}>Ask MANAK →</Button>
        </div>
      </section>
    </div>
  );
}
