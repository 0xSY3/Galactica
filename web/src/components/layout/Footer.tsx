import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer>
      <span>
        <Zap size={14} stroke="var(--accent2)" style={{ verticalAlign: "middle", marginRight: 2 }} />{" "}
        Galactica Agent Network &middot; Tether WDK &middot; USDT/XAUT
      </span>
      <span>Galactica Hackathon 2026 &middot; OpenClaw</span>
    </footer>
  );
}
