import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getDisplayedFinalCommission, getZonePresentation, UNIT_DETAIL_COLUMNS, UNIT_DETAIL_COLUMN_WIDTHS } from "../../src/components/commission-dashboard/unit-detail-presentation.ts";

const zones = {
  greenMinimumPercentage: 105,
  blueMinimumPercentage: 135,
  neutralMultiplier: 1,
  greenMultiplier: 1.15,
  blueMultiplier: 1.25,
};

const cases = [
  ["Rafael / litros", 146.7, "BLUE", 1.25, "navy", "Azul (1.25)"],
  ["Rafael / estoque", 108.7, "GREEN", 1.15, "green", "Verde (1.15)"],
  ["Fabio / litros", 106.5, "GREEN", 1.15, "green", "Verde (1.15)"],
  ["Fabio / estoque", 100.9, "NEUTRAL", 1, "gray", "Neutra (1.00)"],
  ["Gustavo / litros", 179.3, "BLUE", 1.25, "navy", "Azul (1.25)"],
  ["Gustavo / estoque", 119.6, "GREEN", 1.15, "green", "Verde (1.15)"],
  ["Patrick / litros", 117.2, "GREEN", 1.15, "green", "Verde (1.15)"],
  ["Patrick / estoque", 142.8, "BLUE", 1.25, "navy", "Azul (1.25)"],
  ["Tallita / litros", 101.3, "NEUTRAL", 1, "gray", "Neutra (1.00)"],
  ["Tallita / estoque", 120.2, "GREEN", 1.15, "green", "Verde (1.15)"],
] as const;

for (const [name, achievement, zone, , tone, label] of cases) {
  test(`${name} usa a apresentação da zona já resolvida`, () => {
    const presentation = getZonePresentation(achievement, zone, zones);
    assert.equal(presentation.state, zone);
    assert.equal(presentation.tone, tone);
    assert.equal(presentation.label, label);
  });
}

test("Glaiton abaixo de 100% aparece como meta não atingida", () => {
  assert.deepEqual(getZonePresentation(91.8, "NEUTRAL", zones), {
    state: "NOT_MET",
    label: "Não atingiu",
    tone: "red",
  });
});

test("percentuais e zonas são colunas adjacentes nos blocos semânticos", () => {
  assert.equal(UNIT_DETAIL_COLUMNS.indexOf("Zona Litros"), UNIT_DETAIL_COLUMNS.indexOf("% Litros") + 1);
  assert.equal(UNIT_DETAIL_COLUMNS.indexOf("Zona Estoque"), UNIT_DETAIL_COLUMNS.indexOf("% Estoque") + 1);
});

test("todas as colunas têm largura legível e a tabela preserva densidade sem compressão", () => {
  assert.equal(UNIT_DETAIL_COLUMN_WIDTHS.length, UNIT_DETAIL_COLUMNS.length);
  assert.equal(UNIT_DETAIL_COLUMN_WIDTHS[0], 220);
  assert.ok(UNIT_DETAIL_COLUMN_WIDTHS.every((width) => width >= 90));
  assert.equal(UNIT_DETAIL_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0), 2275);
});

test("workspace usa fullscreen real, scroll interno e cabeçalhos contextuais sticky", async () => {
  const [modal, ui] = await Promise.all([
    readFile(new URL("../../src/components/commission-dashboard/unit-detail-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/commission-dashboard/ui.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /h-dvh w-screen max-h-none max-w-none overflow-hidden rounded-none/);
  assert.match(ui, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /w-\[2275px\] min-w-\[2275px\] table-fixed/);
  assert.match(modal, /min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain/);
  assert.match(modal, /h === "Funcionário" \? "left-0 z-30/);
  assert.match(modal, /sticky left-0 z-10/);
  assert.doesNotMatch(modal, /text-\[(?:[0-9]|8)px\]/);
});

test("cabeçalho não contém nomenclaturas ambíguas anteriores", async () => {
  const source = await readFile(new URL("../../src/components/commission-dashboard/unit-detail-modal.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /% Ating\.|Pot\. Est\.|Pot\. Litros/);
});

test("TOTAL fechado usa finalTotalCommission sem zerar funcionário inelegível em litros", async () => {
  const source = await readFile(new URL("../../src/components/commission-dashboard/unit-detail-modal.tsx", import.meta.url), "utf8");
  assert.match(source, /emp\.finalTotalCommission/);
  assert.doesNotMatch(source, /isIneligible \? formatCurrency\(0\).*preview\.finalTotalCommission/s);
  assert.doesNotMatch(source, /emp\.totalCommission !== null \? formatCurrency\(emp\.totalCommission\)/);
});

for (const scenario of [
  { name: "ambas as metas", subtotal: 150, final: 250 },
  { name: "somente litros", subtotal: 80, final: 80 },
  { name: "somente estoque", subtotal: 0, final: 118.78 },
  { name: "nenhuma meta", subtotal: 0, final: 0 },
  { name: "dobras presentes", subtotal: 100, final: 135 },
]) {
  test(`TOTAL consolidado: ${scenario.name}`, () => {
    assert.equal(getDisplayedFinalCommission({
      persistedFinalTotalCommission: scenario.final,
    }), scenario.final);
  });
}

test("preview aberto prevalece sobre snapshot persistido", () => {
  assert.equal(getDisplayedFinalCommission({
    persistedFinalTotalCommission: 118.78,
    previewFinalTotalCommission: 200,
  }), 200);
});
