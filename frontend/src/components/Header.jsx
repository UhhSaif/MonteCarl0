import { ArrowUpRight, Aperture } from "lucide-react";
export default function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#" aria-label="MonteCarl0 home">
        <span className="brand-mark"><Aperture size={27} strokeWidth={1.2} /></span>
        <span>MonteCarl<span className="muted-brand">0</span><small>THE ART OF PROBABILITY</small></span>
      </a>
      <nav className="header-right" aria-label="Main navigation">
        <a href="#market">The market</a>
        <a href="#simulation">The simulation</a>
        <a className="source-link" href="https://github.com/UhhSaif/MonteCarl0" target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} /></a>
      </nav>
    </header>
  );
}
