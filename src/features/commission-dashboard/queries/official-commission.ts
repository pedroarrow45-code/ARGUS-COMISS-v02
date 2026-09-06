type DecimalLike = { toNumber(): number };

function toNumber(value: DecimalLike | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

/**
 * Resultado financeiro oficial. O fallback existe apenas para registros legados
 * que ainda não possuem finalTotalCommission persistido.
 */
export function getOfficialCommissionValue(record: {
  finalTotalCommission: DecimalLike | number | null | undefined;
  totalCommission: DecimalLike | number | null | undefined;
}) {
  return record.finalTotalCommission != null
    ? toNumber(record.finalTotalCommission)
    : toNumber(record.totalCommission);
}
