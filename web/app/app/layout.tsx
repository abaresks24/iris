import { Providers } from "@/app/providers";
import { AppNav } from "@/components/AppNav";
import { Ambiance } from "@/components/Ambiance";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Ambiance />
      <AppNav />
      <div className="container">{children}</div>
    </Providers>
  );
}
