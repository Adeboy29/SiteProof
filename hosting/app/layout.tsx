import "./globals.css";
export const metadata = {
  metadataBase: new URL("https://siteproof-adeboy29.fasure333.chatgpt.site"),
  title: "SiteProof — Build with certainty",
  description: "Assess construction milestones with a GenLayer Intelligent Contract.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
