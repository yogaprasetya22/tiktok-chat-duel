import TikTokLiveChat from "@/components/TikTokLiveChat";

export const metadata = {
  title: "TikTok Live Chat - Next.js",
  description: "Real-time TikTok Live Chat with Next.js, TypeScript, and Bun",
};

export default function Home() {
  return (
    <main className=" min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 select-none touch-none">
      <TikTokLiveChat />
    </main>
  );
}
