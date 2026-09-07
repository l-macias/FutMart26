import { redirect } from "next/navigation";

export default function GlobalRankingPage() {
  redirect("/rankings?scope=global");
}
