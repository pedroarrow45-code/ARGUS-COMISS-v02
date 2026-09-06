import { recalculateClosedMonth } from "../src/features/commission-dashboard/actions/recalculate-closed-month";

const args = Object.fromEntries(process.argv.slice(2).map((part) => { const [key, ...value] = part.replace(/^--/, "").split("="); return [key, value.join("=")]; }));
const result = await recalculateClosedMonth({
  unitId: args.unit, year: Number(args.year), month: Number(args.month), actor: args.actor ?? "", reason: args.reason ?? "",
});
if (!result.success) { console.error(result.error); process.exitCode = 1; } else console.log("Fechamento recalculado e auditado com sucesso.");
