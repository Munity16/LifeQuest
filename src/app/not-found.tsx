import Link from "next/link";
import { MapPinned } from "lucide-react";

export default function NotFound() {
  return <main id="main-content" className="route-state"><div className="state-card"><MapPinned size={29} /><h1>This path is not on the map</h1><p>The campaign or quest may not exist, or it may belong to another hero.</p><Link className="button button-primary" href="/">Return home</Link></div></main>;
}
