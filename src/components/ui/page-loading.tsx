import { Card } from "@/components/ui/card";

type PageLoadingProps = {
  title?: string;
  message?: string;
  variant?: "dashboard" | "projects" | "insights" | "news" | "default";
};

export function PageLoading({
  title = "Carregando dados...",
  message = "Preparando os projetos e indicadores salvos.",
  variant = "default",
}: PageLoadingProps) {
  const shimmer =
    "animate-pulse rounded-full bg-[linear-gradient(90deg,rgba(19,33,43,0.06),rgba(19,33,43,0.14),rgba(19,33,43,0.06))]";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className={`${shimmer} h-5 w-32`} />
            <div className={`${shimmer} h-10 w-full max-w-2xl rounded-2xl`} />
            <div className={`${shimmer} h-4 w-full max-w-xl`} />
            <div className={`${shimmer} h-4 w-full max-w-lg`} />
          </div>

          <div className="rounded-[1.75rem] border border-ink/8 bg-sand/80 p-6">
            <div className={`${shimmer} h-4 w-28`} />
            <div className={`${shimmer} mt-4 h-12 w-36 rounded-2xl`} />
            <div className={`${shimmer} mt-5 h-3 w-full`} />
            <div className="mt-4 flex justify-between gap-3">
              <div className={`${shimmer} h-4 w-24`} />
              <div className={`${shimmer} h-4 w-24`} />
            </div>
          </div>
        </div>
      </Card>

      <div className="px-1">
        <p className="section-eyebrow">Carregando</p>
        <h1 className="section-title">{title}</h1>
        <p className="text-sm leading-7 text-ink/60">{message}</p>
      </div>

      {variant === "projects" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="space-y-5">
            <div className={`${shimmer} h-5 w-24`} />
            <div className={`${shimmer} h-9 w-56 rounded-2xl`} />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className={`${shimmer} h-4 w-28`} />
                  <div className={`${shimmer} h-12 w-full rounded-2xl`} />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <div className={`${shimmer} h-11 w-36 rounded-2xl`} />
              <div className={`${shimmer} h-11 w-32 rounded-2xl`} />
            </div>
          </Card>

          <div className="space-y-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className={`${shimmer} h-6 w-40`} />
                  <div className={`${shimmer} h-8 w-28 rounded-full`} />
                </div>
                <div className={`${shimmer} h-8 w-72 rounded-2xl`} />
                <div className={`${shimmer} h-3 w-full`} />
                <div className={`${shimmer} h-3 w-full max-w-[80%]`} />
                <div className="flex gap-3">
                  <div className={`${shimmer} h-11 w-36 rounded-2xl`} />
                  <div className={`${shimmer} h-11 w-24 rounded-2xl`} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {variant === "insights" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`${shimmer} h-4 w-28`} />
                  <div className={`${shimmer} h-7 w-20 rounded-full`} />
                </div>
                <div className={`${shimmer} h-1.5 w-20`} />
                <div className={`${shimmer} h-12 w-36 rounded-2xl`} />
                <div className={`${shimmer} h-4 w-full`} />
                <div className={`${shimmer} h-4 w-[85%]`} />
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <Card className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[1.75rem] border border-ink/8 p-5">
                  <div className="flex items-center justify-between">
                    <div className={`${shimmer} h-7 w-24 rounded-full`} />
                    <div className={`${shimmer} h-3 w-3 rounded-full`} />
                  </div>
                  <div className={`${shimmer} mt-4 h-6 w-48`} />
                  <div className={`${shimmer} mt-4 h-4 w-full`} />
                  <div className={`${shimmer} mt-2 h-4 w-[88%]`} />
                </div>
              ))}
            </Card>

            <Card className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[1.75rem] border border-ink/8 p-5">
                  <div className={`${shimmer} h-4 w-28`} />
                  <div className={`${shimmer} mt-3 h-10 w-24 rounded-2xl`} />
                  <div className={`${shimmer} mt-3 h-4 w-full`} />
                  <div className={`${shimmer} mt-2 h-4 w-[78%]`} />
                </div>
              ))}
            </Card>
          </div>
        </div>
      ) : null}

      {variant === "news" ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden p-0">
              <div className="border-b border-ink/8 px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-3">
                    <div className={`${shimmer} h-7 w-24 rounded-full`} />
                    <div className={`${shimmer} h-7 w-28 rounded-full`} />
                  </div>
                  <div className={`${shimmer} h-4 w-20`} />
                </div>
              </div>
              <div className="space-y-5 px-6 py-6">
                <div className={`${shimmer} h-4 w-24`} />
                <div className={`${shimmer} h-8 w-full rounded-2xl`} />
                <div className={`${shimmer} h-8 w-[82%] rounded-2xl`} />
                <div className={`${shimmer} h-4 w-full`} />
                <div className={`${shimmer} h-4 w-[90%]`} />
                <div className="flex items-center justify-between border-t border-ink/8 pt-5">
                  <div>
                    <div className={`${shimmer} h-3 w-14`} />
                    <div className={`${shimmer} mt-2 h-4 w-28`} />
                  </div>
                  <div className={`${shimmer} h-11 w-28 rounded-2xl`} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {variant === "dashboard" || variant === "default" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="space-y-4">
                <div className={`${shimmer} h-4 w-24`} />
                <div className={`${shimmer} h-10 w-36 rounded-2xl`} />
                <div className={`${shimmer} h-4 w-40`} />
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Card key={index} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`${shimmer} h-4 w-28`} />
                    <div className={`${shimmer} mt-3 h-8 w-36 rounded-2xl`} />
                  </div>
                  <div className={`${shimmer} h-8 w-24 rounded-full`} />
                </div>
                <div className={`${shimmer} h-3 w-full`} />
                <div className="grid grid-cols-2 gap-3">
                  <div className={`${shimmer} h-16 w-full rounded-2xl`} />
                  <div className={`${shimmer} h-16 w-full rounded-2xl`} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
