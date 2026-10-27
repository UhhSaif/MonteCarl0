import { Activity, ArrowUpRight } from "lucide-react";
export default function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="MonteCarl0 home">
        <span className="brand-mark">
          <Activity size={23} />
        </span>
        <span>
          Monte<span className="muted-brand">Carl0</span>
          <small>QUANTITATIVE MARKET RESEARCH</small>
        </span>
      </a>
      <div className="header-right">
        <span className="version">PHASE 01</span>
        <a
          href="https://github.com/UhhSaif/MonteCarl0"
          target="_blank"
          rel="noreferrer"
        >
          Project source <ArrowUpRight size={14} />
        </a>
      </div>
    </header>
  );
}
