import { Providers } from "@/app/providers";
import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppNav />
      <div className="container">{children}</div>
    </Providers>
  );
}
