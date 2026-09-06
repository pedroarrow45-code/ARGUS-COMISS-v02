import { PageLoading } from "@/components/ui/page-loading";

export default function Loading() {
  return (
    <PageLoading
      variant="default"
      title="Carregando plataforma..."
      message="Organizando a experiência da aplicação."
    />
  );
}
