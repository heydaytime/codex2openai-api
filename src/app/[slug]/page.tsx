import { PagePreview } from "@/components/page-preview";
import { samplePageConfig } from "@/lib/page-config";

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = { ...samplePageConfig, slug };

  return (
    <main className="min-h-screen bg-black p-3 md:p-8">
      <div className="mx-auto max-w-5xl">
        <PagePreview config={config} />
      </div>
    </main>
  );
}
