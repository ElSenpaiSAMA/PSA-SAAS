import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { getOrgContext } from "@/lib/data/session";
import { createThread } from "../actions";
import { ThreadForm } from "../thread-form";

export const metadata: Metadata = { title: "Nuevo hilo · Foro" };

export default async function NewThreadPage({ params }: PageProps<"/app/[orgId]/forum/new">) {
  const { orgId } = await params;
  await getOrgContext(orgId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/app/${orgId}/forum`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Volver al foro
      </Link>
      <PageHeader title="Nuevo hilo" description="Lo van a ver todas las personas de la empresa." />
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <ThreadForm action={createThread.bind(null, orgId)} submitLabel="Publicar hilo" />
      </div>
    </div>
  );
}
