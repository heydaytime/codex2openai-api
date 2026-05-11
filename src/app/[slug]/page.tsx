import { PagePreview } from "@/components/page-preview";
import { notFound } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export const revalidate = 60;

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const reservedRoutes = ["login", "onboarding", "dashboard", "api", "admin"];
  if (reservedRoutes.includes(slug)) return notFound();

  try {
    const response = await fetch(`${BACKEND_URL}/api/page/${slug}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) return notFound();

    const data = await response.json();
    if (!data.ok || !data.config) return notFound();

    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto max-w-lg">
          <PagePreview config={data.config} />
        </div>
      </main>
    );
  } catch {
    return notFound();
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const response = await fetch(`${BACKEND_URL}/api/page/${slug}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) return { title: "Not Found" };

    const data = await response.json();
    if (!data.ok || !data.config) return { title: "Not Found" };

    const config = data.config;
    return {
      title: `${config.profile?.displayName ?? slug} | linkqt.me`,
      description: config.profile?.bio ?? `Check out ${slug}'s link page on linkqt.me`,
      openGraph: {
        title: `${config.profile?.displayName ?? slug}`,
        description: config.profile?.bio ?? `Check out ${slug}'s link page`,
        url: `https://linkqt.me/${slug}`,
      },
    };
  } catch {
    return { title: "linkqt.me" };
  }
}
