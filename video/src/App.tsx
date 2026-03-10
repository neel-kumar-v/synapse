import React, { useState } from 'react';

const projects = [
  { title: 'Weather Dashboard', tags: ['React'], desc: 'Real-time weather data with animated charts and a 7-day forecast.' },
  { title: 'Task Manager', tags: ['React', 'Node.js', 'CSS', 'TypeScript'], desc: 'Drag-and-drop kanban board with local persistence and dark mode.' },
  { title: 'Markdown Editor', tags: ['UI'], desc: 'Split-pane live preview editor with syntax highlighting and export.' },
];

const skills = ['React', 'TypeScript', 'Node.js', 'CSS', 'REST APIs', 'Git'];

export default function App() {
  const [active, setActive] = useState<'home' | 'projects' | 'contact'>('home');
  const [sent, setSent] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  const openContactPopup = () => {
    setPopupOpen(true);
    setSent(false);
  };

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-logo">Alex Rivera</span>
        <div className="nav-links">
          {(['home', 'projects', 'contact'] as const).map((page) => (
            <button
              key={page}
              className={`nav-link ${active === page ? 'active' : ''}`}
              onClick={() => {
                if (page === 'contact') {
                  openContactPopup();
                } else {
                  setActive(page);
                  setSent(false);
                }
              }}
            >
              {page.charAt(0).toUpperCase() + page.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      <main className="main">
        {active === 'home' && (
          <section className="hero">
            <div className="hero-badge">Available for work</div>
            <h1 className="hero-title">
              I build <span className="accent">fast, clean</span><br />web experiences.
            </h1>
            <p className="hero-sub">
              Full-stack developer with 4 years of experience crafting products people love.
              Focused on React, TypeScript, and thoughtful design.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => setActive('projects')}>See my work</button>
              <button className="btn btn-outline" onClick={openContactPopup}>Get in touch</button>
            </div>
            <div className="skills">
              {skills.map((s) => <span key={s} className="skill-tag">{s}</span>)}
            </div>
          </section>
        )}

        {active === 'projects' && (
          <section className="projects-section">
            <h2 className="section-title">Selected Work</h2>
            <p className="section-sub">A handful of things I've built recently.</p>
            <div className="cards">
              {projects.map((p) => (
                <div key={p.title} className="card">
                  <div className="card-top">
                    <div className="card-tags">
                      {p.tags.map((tag) => (
                        <span key={tag} className="card-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <h3 className="card-title">{p.title}</h3>
                  <p className="card-desc">{p.desc}</p>
                  <button className="card-link">View project →</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {active === 'contact' && (
          <section className="contact-section">
            <h2 className="section-title">Say Hello</h2>
            <p className="section-sub">Have a project in mind? I'd love to hear about it.</p>
            {sent ? (
              <div className="sent-msg">
                <span className="sent-icon">✓</span>
                <p>Message sent! I'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
                <div className="form-row">
                  <input className="input" placeholder="Your name" required />
                  <input className="input" type="email" placeholder="Email address" required />
                </div>
                <textarea className="input textarea" placeholder="Tell me about your project..." rows={5} required />
                <button type="submit" className="btn btn-primary">Send Message</button>
              </form>
            )}
          </section>
        )}
      </main>

      {popupOpen && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup" role="dialog" aria-modal="true" aria-labelledby="popup-title">
            <h2 id="popup-title" className="section-title">Say Hello</h2>
            <p className="section-sub">Have a project in mind? I'd love to hear about it.</p>
            {sent ? (
              <div className="sent-msg">
                <span className="sent-icon">✓</span>
                <p>Message sent! I'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
                <div className="form-row">
                  <input className="input" placeholder="Your name" required />
                  <input className="input" type="email" placeholder="Email address" required />
                </div>
                <textarea className="input textarea" placeholder="Tell me about your project..." rows={5} required />
                <button type="submit" className="btn btn-primary">Send Message</button>
              </form>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <span>© 2026 Alex Rivera</span>
        <div className="footer-links">
          <a href="#">GitHub</a>
          <a href="#">LinkedIn</a>
          <a href="#">Twitter</a>
        </div>
      </footer>
    </div>
  );
}
