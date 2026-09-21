import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GAgenda",
    template: "%s · GAgenda",
  },
  description:
    "L'emploi du temps du Génie Atomique, sur téléphone, sans passer par l'ENT.",
  applicationName: "GAgenda",
  appleWebApp: {
    capable: true,
    title: "GAgenda",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#003367",
  // L'app tourne en plein écran une fois installée sur l'écran d'accueil.
  viewportFit: "cover",
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
