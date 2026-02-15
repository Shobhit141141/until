import { MainLayoutClient } from "./MainLayoutClient";

/** Force dynamic so prerender does not load @stacks/connect (avoids "module factory not available"). */
export const dynamic = "force-dynamic";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <MainLayoutClient>{children}</MainLayoutClient>;
}
