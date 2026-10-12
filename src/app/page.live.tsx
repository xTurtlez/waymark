import { redirect } from "next/navigation";
import { getViewer } from "@/server/viewer";

export default async function Home() {
  const viewer = await getViewer();
  if (viewer?.kind === "staff") redirect("/practice");
  if (viewer?.kind === "family") redirect("/portal");
  redirect(viewer ? "/sign-in?error=no-access" : "/sign-in");
}
