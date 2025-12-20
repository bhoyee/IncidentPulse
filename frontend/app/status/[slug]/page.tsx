import { redirect } from "next/navigation";

export default function StatusSlugPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const target = `/status?orgSlug=${encodeURIComponent(slug)}`;
  redirect(target);
}
