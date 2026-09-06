import { Card } from "@/components/ui/card";
import { dailyQuotes } from "@/data/daily-quotes";

function getDailyQuote() {
  const today = new Date();
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const hash = key.split("").reduce((total, char) => total + char.charCodeAt(0), 0);

  return dailyQuotes[hash % dailyQuotes.length];
}

export function DailyQuoteCard() {
  const quote = getDailyQuote();

  return (
    <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(19,33,43,0.98),rgba(31,122,107,0.92))] text-white">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Frase do dia</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Clareza para executar melhor</h2>
        </div>

        <p className="max-w-3xl text-lg leading-8 text-white/88 md:text-[1.15rem]">"{quote}"</p>

        <p className="text-sm text-white/60">
          {"Reflex\u00e3o di\u00e1ria sobre execu\u00e7\u00e3o, neg\u00f3cios, tecnologia e crescimento."}
        </p>
      </div>
    </Card>
  );
}
