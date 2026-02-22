import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { SWRConfig } from "swr";
import { ToastProvider } from "@/components/ui/toast";

// Headings: Poppins (ticket360.com.br)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

// Body: Roboto (ticket360.com.br)
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Sympla 360 - Plataforma de Eventos",
  description: "Sua plataforma de eventos e ingressos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${poppins.variable} ${roboto.variable} font-body text-light-text bg-white`}>
        <SessionProvider>
          <SWRConfig
            value={{
              revalidateOnFocus: false,
              dedupingInterval: 60000, // 1 minute
              shouldRetryOnError: false,
            }}
          >
            <ToastProvider>
              {children}
            </ToastProvider>
          </SWRConfig>
        </SessionProvider>
      </body>
    </html>
  );
}
