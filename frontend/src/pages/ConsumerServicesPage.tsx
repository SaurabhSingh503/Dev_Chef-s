import React, { useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

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

export function ConsumerServicesPage({ go }: { go: (path: string) => void }) {
  const setRef = useIntersectionObserver();

  return (
    <div className="consumer-services-page">
      {/* 1. HERO SECTION */}
      <section className="cs-hero" ref={setRef(0)}>
        <p className="eyebrow">CONSUMER SERVICES</p>
        <h1>Standards, made easier to understand.</h1>
        <p className="hero-copy">
          MANAK is a free standards intelligence platform that helps consumers explore standards, understand technical requirements and find the context they need to make informed decisions.
        </p>
        <p className="cs-supporting-line">Free to use · Standards information · AI-assisted guidance</p>
        <div className="actions">
          <Button onClick={() => go('/standards')}>Explore standards →</Button>
          <Button variant="secondary" onClick={() => go('/ai-intelligence')}>Ask MANAK →</Button>
        </div>
      </section>

      {/* 2. WHAT IS MANAK? */}
      <section className="cs-section cs-bg-light" ref={setRef(1)}>
        <p className="eyebrow">WHAT IS MANAK?</p>
        <h2>A free service for understanding standards.</h2>
        <p className="cs-intro">
          Standards can be technical, detailed and difficult to navigate. MANAK brings standards information, guidance and AI-assisted explanations into one accessible experience, helping people understand what standards mean and where they matter.
        </p>
        <div className="feature-grid three-col">
          <Card className="interactive-card">
            <h3>01 — DISCOVER</h3>
            <p>Find standards and related information relevant to your question or area of interest.</p>
          </Card>
          <Card className="interactive-card">
            <h3>02 — UNDERSTAND</h3>
            <p>Explore technical requirements through clearer explanations and useful context.</p>
          </Card>
          <Card className="interactive-card">
            <h3>03 — VERIFY</h3>
            <p>Use authoritative standards and official information when you need to confirm an important detail.</p>
          </Card>
        </div>
      </section>

      {/* 3. WHY STANDARDS MATTER */}
      <section className="cs-section" ref={setRef(2)}>
        <p className="eyebrow">WHY STANDARDS MATTER</p>
        <h2>Standards create a common language for quality, safety and trust.</h2>
        <p className="cs-intro">
          Standards help establish consistent requirements and expectations across products, processes and services. Understanding them makes it easier to interpret technical information and make informed decisions.
        </p>
        <div className="feature-grid two-col">
          <Card>
            <h3>QUALITY</h3>
            <p>Consistent requirements help define expected levels of quality and performance.</p>
          </Card>
          <Card>
            <h3>SAFETY</h3>
            <p>Standards can establish requirements intended to address safety and performance.</p>
          </Card>
          <Card>
            <h3>TRUST</h3>
            <p>Common requirements create a clearer reference for manufacturers, organizations and consumers.</p>
          </Card>
          <Card>
            <h3>CONSISTENCY</h3>
            <p>Standards help different people and organizations work from shared technical expectations.</p>
          </Card>
        </div>
      </section>

      {/* 4. WHAT CAN CONSUMERS DO WITH MANAK? */}
      <section className="cs-section cs-bg-light" ref={setRef(3)}>
        <p className="eyebrow">EXPLORE & UNDERSTAND</p>
        <h2>Start with a question. Find the information behind it.</h2>
        <div className="feature-grid two-col">
          <Card>
            <h3>FIND STANDARDS</h3>
            <p>Discover standards relevant to products, materials, services and areas of interest.</p>
          </Card>
          <Card>
            <h3>UNDERSTAND REQUIREMENTS</h3>
            <p>Explore technical requirements through clearer explanations and contextual information.</p>
          </Card>
          <Card>
            <h3>ASK QUESTIONS</h3>
            <p>Use AI-assisted guidance to explore standards-related questions in natural language.</p>
          </Card>
          <Card>
            <h3>FIND CONTEXT</h3>
            <p>Connect standards with testing, handbooks and other parts of the standards ecosystem.</p>
          </Card>
        </div>
      </section>

      {/* 6. WHERE STANDARDS APPEAR IN EVERYDAY LIFE */}
      <section className="cs-section cs-bg-light" ref={setRef(5)}>
        <p className="eyebrow">EVERYDAY CONTEXT</p>
        <h2>Standards are part of more of life than you might think.</h2>
        <p className="cs-intro">
          Standards can apply across many areas of everyday life and industry. MANAK helps make that information easier to explore.
        </p>
        <div className="feature-grid three-col">
          <Card>
            <h3>FOOD & WATER</h3>
            <p>Explore standards and requirements related to everyday food and water products.</p>
          </Card>
          <Card>
            <h3>ELECTRICAL</h3>
            <p>Discover standards connected to electrical products, safety and performance.</p>
          </Card>
          <Card>
            <h3>CONSTRUCTION</h3>
            <p>Understand the standards behind materials, components and construction practices.</p>
          </Card>
          <Card>
            <h3>ENERGY & BATTERIES</h3>
            <p>Explore standards related to batteries, energy products and emerging technologies.</p>
          </Card>
          <Card>
            <h3>TEXTILES</h3>
            <p>Discover standards relevant to textile products and their requirements.</p>
          </Card>
          <Card>
            <h3>HOUSEHOLD PRODUCTS</h3>
            <p>Explore standards that may apply to products used in everyday life.</p>
          </Card>
        </div>
      </section>

      {/* 7. AI INTELLIGENCE */}
      <section className="cs-section cs-ai-section" ref={setRef(6)}>
        <p className="eyebrow">AI INTELLIGENCE</p>
        <h2>Ask questions. Understand the context.</h2>
        <p className="cs-intro">
          MANAK's AI assistance helps you explore standards-related questions, understand technical concepts and find useful context without requiring you to begin with highly technical terminology.
        </p>
        <div className="cs-prompts">
          <div className="cs-prompt">"What does this standard cover?"</div>
          <div className="cs-prompt">"What requirements apply to this product?"</div>
          <div className="cs-prompt">"Explain this technical requirement simply."</div>
          <div className="cs-prompt">"Which standards are relevant to this category?"</div>
        </div>
        <div style={{ marginTop: '2rem' }}>
          <Button onClick={() => go('/ai-intelligence')}>Ask MANAK →</Button>
        </div>
        <p className="cs-disclaimer">
          AI-generated explanations are provided for informational purposes. Always verify important requirements, specifications, and compliance decisions against the applicable official standard or authoritative source.
        </p>
      </section>

      {/* 9. WHY MANAK IS FREE */}
      <section className="cs-section cs-bg-light" ref={setRef(8)}>
        <p className="eyebrow">ACCESS FOR EVERYONE</p>
        <h2>Understanding standards shouldn't require a subscription.</h2>
        <p className="cs-intro">
          MANAK is designed as a free service that makes standards-related information and understanding more accessible to consumers, organizations and knowledge teams.
        </p>
        <div className="feature-grid three-col">
          <Card>
            <h3>FREE ACCESS</h3>
            <p>No subscription is required to use the MANAK experience.</p>
          </Card>
          <Card>
            <h3>ACCESSIBLE UNDERSTANDING</h3>
            <p>Complex standards information is presented in a way that is easier to explore.</p>
          </Card>
          <Card>
            <h3>CONNECTED INFORMATION</h3>
            <p>Standards, guidance and related context are brought together in one place.</p>
          </Card>
        </div>
      </section>

      {/* 10. FINAL CTA */}
      <section className="cs-section cs-cta-section" ref={setRef(9)}>
        <p className="eyebrow">START EXPLORING</p>
        <h2>Better understanding starts with better information.</h2>
        <p className="cs-intro">
          Explore standards, understand technical requirements and ask questions with MANAK, completely free.
        </p>
        <div className="actions">
          <Button onClick={() => go('/standards')}>Explore standards →</Button>
          <Button variant="secondary" onClick={() => go('/ai-intelligence')}>Ask MANAK →</Button>
        </div>
      </section>
    </div>
  );
}
