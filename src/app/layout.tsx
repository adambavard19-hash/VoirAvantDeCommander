import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "VoirAvantDeCommander — Menus 3D et réalité augmentée pour restaurants",
    template: "%s · VoirAvantDeCommander",
  },
  description:
    "Transformez votre carte en une expérience immersive : vos clients scannent un QR code et découvrent vos plats en 3D et en réalité augmentée, directement sur leur table.",
  applicationName: "VoirAvantDeCommander",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
