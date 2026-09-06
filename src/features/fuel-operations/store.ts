"use client";

import { create } from "zustand";

import {
  planAutomaticAllocation,
  suggestOrderAllocations,
  validateManualAllocation,
  validateOrderInput,
  validateTruckInput,
} from "./planning";
import { getOrderLoadState } from "./selectors";
import { fuelOperationsSeed } from "./seed";
import { cloneSeedData, createId, getTruckById } from "./utils";
import type {
  ActionResult,
  Allocation,
  AllocationInput,
  Notice,
  Order,
  OrderFormInput,
  Truck,
  TruckFormInput,
} from "./types";

interface FuelOperationsState {
  trucks: Truck[];
  orders: Order[];
  allocations: Allocation[];
  notice: Notice | null;
  upsertTruck: (input: TruckFormInput) => ActionResult;
  createOrder: (input: OrderFormInput) => ActionResult;
  allocateOrder: (input: AllocationInput) => ActionResult;
  removeAllocation: (allocationId: string) => ActionResult;
  applySuggestedAllocation: (orderId: string) => ActionResult;
  autoAllocatePendingOrders: () => ActionResult;
  clearNotice: () => void;
}

function nextOrderCode(existingCodes: string[]): string {
  const nextNumber =
    existingCodes
      .map((code) => Number(code.replace("PED-", "")))
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => right - left)[0] ?? 0;

  return `PED-${String(nextNumber + 1).padStart(3, "0")}`;
}

function normalizeTruckInput(input: TruckFormInput): TruckFormInput {
  return {
    ...input,
    name: input.name.trim(),
    identifier: input.identifier.trim(),
    totalCapacityLiters: Math.trunc(input.totalCapacityLiters),
    compartments: input.compartments.map((compartment, index) => ({
      ...compartment,
      label: `Boca ${index + 1}`,
      capacityLiters: Math.trunc(compartment.capacityLiters),
    })),
  };
}

function buildCreatedAllocation(
  input: Pick<Allocation, "orderId" | "truckId" | "compartmentId" | "fuelType" | "liters">,
): Allocation {
  return {
    id: createId("alloc"),
    createdAt: new Date().toISOString(),
    ...input,
  };
}

const initialData = cloneSeedData(fuelOperationsSeed);

export const useFuelOperationsStore = create<FuelOperationsState>((set, get) => ({
  trucks: initialData.trucks,
  orders: initialData.orders,
  allocations: initialData.allocations,
  notice: null,
  upsertTruck(input) {
    const normalizedInput = normalizeTruckInput(input);
    const validation = validateTruckInput(normalizedInput, get().trucks, get().allocations);

    if (validation.errors.length > 0) {
      const result = { tone: "error", message: validation.errors[0] } as const;
      set({ notice: result });
      return result;
    }

    const trucks = [...get().trucks];
    const existingIndex = normalizedInput.id ? trucks.findIndex((truck) => truck.id === normalizedInput.id) : -1;
    const truck: Truck = {
      id: normalizedInput.id ?? createId("truck"),
      name: normalizedInput.name,
      identifier: normalizedInput.identifier,
      totalCapacityLiters: normalizedInput.totalCapacityLiters,
      compartments: normalizedInput.compartments.map((compartment) => ({
        ...compartment,
        id: compartment.id || createId("compartment"),
      })),
    };

    if (existingIndex >= 0) {
      trucks[existingIndex] = truck;
    } else {
      trucks.push(truck);
    }

    const result = {
      tone: validation.warnings.length > 0 ? "warning" : "success",
      message:
        validation.warnings[0] ??
        (existingIndex >= 0 ? `${truck.name} atualizado com sucesso.` : `${truck.name} cadastrado com sucesso.`),
    } as const;

    set({ trucks, notice: result });
    return result;
  },
  createOrder(input) {
    const normalizedInput = {
      ...input,
      customer: input.customer.trim(),
      liters: Math.trunc(input.liters),
    };
    const validation = validateOrderInput(normalizedInput);

    if (validation) {
      set({ notice: validation });
      return validation;
    }

    const order: Order = {
      id: createId("order"),
      code: nextOrderCode(get().orders.map((currentOrder) => currentOrder.code)),
      customer: normalizedInput.customer,
      fuelType: normalizedInput.fuelType,
      liters: normalizedInput.liters,
      createdAt: new Date().toISOString(),
    };

    const result = {
      tone: "success",
      message: `${order.code} cadastrado para ${order.customer}.`,
    } as const;

    set({ orders: [order, ...get().orders], notice: result });
    return result;
  },
  allocateOrder(input) {
    const normalizedInput = {
      ...input,
      liters: Math.trunc(input.liters),
    };
    const validation = validateManualAllocation(normalizedInput, get().trucks, get().orders, get().allocations);

    if (validation) {
      set({ notice: validation });
      return validation;
    }

    const order = get().orders.find((currentOrder) => currentOrder.id === normalizedInput.orderId);

    if (!order) {
      const result = { tone: "error", message: "Pedido nao encontrado para finalizar a alocacao." } as const;
      set({ notice: result });
      return result;
    }

    const allocation = buildCreatedAllocation({
      orderId: normalizedInput.orderId,
      truckId: normalizedInput.truckId,
      compartmentId: normalizedInput.compartmentId,
      fuelType: order.fuelType,
      liters: normalizedInput.liters,
    });

    const allocations = [...get().allocations, allocation];
    const orderState = getOrderLoadState(order, allocations);
    const truck = getTruckById(get().trucks, normalizedInput.truckId);
    const result = {
      tone: orderState.remainingLiters > 0 ? "warning" : "success",
      message:
        orderState.remainingLiters > 0
          ? `${order.code} alocado parcialmente. Restam ${orderState.remainingLiters.toLocaleString("pt-BR")} L pendentes.`
          : `${order.code} encaixado com sucesso no ${truck?.name ?? "caminhao"}.`,
    } as const;

    set({ allocations, notice: result });
    return result;
  },
  removeAllocation(allocationId) {
    const allocation = get().allocations.find((currentAllocation) => currentAllocation.id === allocationId);

    if (!allocation) {
      const result = { tone: "error", message: "Alocacao nao encontrada para remocao." } as const;
      set({ notice: result });
      return result;
    }

    const order = get().orders.find((currentOrder) => currentOrder.id === allocation.orderId);
    const allocations = get().allocations.filter((currentAllocation) => currentAllocation.id !== allocationId);
    const result = {
      tone: "success",
      message: `Alocacao removida${order ? ` do pedido ${order.code}` : ""}.`,
    } as const;

    set({ allocations, notice: result });
    return result;
  },
  applySuggestedAllocation(orderId) {
    const order = get().orders.find((currentOrder) => currentOrder.id === orderId);

    if (!order) {
      const result = { tone: "error", message: "Pedido nao encontrado para aplicar sugestao." } as const;
      set({ notice: result });
      return result;
    }

    const suggestion = suggestOrderAllocations(order, get().trucks, get().allocations);

    if (suggestion.allocations.length === 0) {
      const result = {
        tone: "warning",
        message: `Nenhum encaixe valido foi encontrado para ${order.code}.`,
      } as const;
      set({ notice: result });
      return result;
    }

    const allocations = [
      ...get().allocations,
      ...suggestion.allocations.map((allocation) =>
        buildCreatedAllocation({
          orderId: allocation.orderId,
          truckId: allocation.truckId,
          compartmentId: allocation.compartmentId,
          fuelType: allocation.fuelType,
          liters: allocation.liters,
        }),
      ),
    ];

    const result = {
      tone: suggestion.remainingLiters > 0 ? "warning" : "success",
      message:
        suggestion.remainingLiters > 0
          ? `${order.code} recebeu sugestao parcial. Restam ${suggestion.remainingLiters.toLocaleString("pt-BR")} L sem encaixe.`
          : `${order.code} distribuido automaticamente com encaixe valido.`,
    } as const;

    set({ allocations, notice: result });
    return result;
  },
  autoAllocatePendingOrders() {
    const plan = planAutomaticAllocation(get().orders, get().trucks, get().allocations);

    if (plan.allocations.length === 0) {
      const result = {
        tone: "warning",
        message: "Nao encontrei novas alocacoes automaticas validas para os pedidos pendentes.",
      } as const;
      set({ notice: result });
      return result;
    }

    const allocations = [
      ...get().allocations,
      ...plan.allocations.map((allocation) =>
        buildCreatedAllocation({
          orderId: allocation.orderId,
          truckId: allocation.truckId,
          compartmentId: allocation.compartmentId,
          fuelType: allocation.fuelType,
          liters: allocation.liters,
        }),
      ),
    ];

    const result = {
      tone: plan.unresolvedOrders.length > 0 ? "warning" : "success",
      message:
        plan.unresolvedOrders.length > 0
          ? `Distribuicao automatica concluida com pendencias em ${plan.unresolvedOrders.length} pedido(s).`
          : `Distribuicao automatica aplicada para ${plan.processedOrders} pedido(s) pendentes.`,
    } as const;

    set({ allocations, notice: result });
    return result;
  },
  clearNotice() {
    set({ notice: null });
  },
}));
