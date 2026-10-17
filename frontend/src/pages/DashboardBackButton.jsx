import { ArrowLeft } from "lucide-react";
import "../styles/RecentActivity.css";
export default function DashboardBackButton({ onClick }) {
  return <div className="kc-dashboard-back-row"><button className="kc-dashboard-back" type="button" onClick={onClick}><ArrowLeft size={17} /> Back to dashboard</button></div>;
}
