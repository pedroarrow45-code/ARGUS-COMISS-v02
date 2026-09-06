import { FUEL_MAP } from "./catalog";
import { getOrderLoadState, getTruckLoadState } from "./selectors";
import { getTruckById } from "./utils";
import type {
  ActionResult,
  Allocation,
  AllocationInput,
  AutoAllocationPlan,
  Order,
  OrderFormInput,
  SuggestionResult,
  Truck,
  TruckFormInput,
} from "./types";

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function normalizeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return NaN;
  }

  return Math.trunc(value);
}

export function validateTruckInput(
  input: TruckFormInput,
  trucks: Truck[],
  allocations: Allocation[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const totalCapacityLiters = normalizeInteger(input.totalCapacityLiters);

  if (!input.name.trim()) {
    errors.push("Informe o nome do caminhao.");
  }

  if (!input.identifier.trim()) {
    errors.push("Informe a identificacao do caminhao.");
  }

  if (!Number.isFinite(totalCapacityLiters) || totalCapacityLiters <= 0) {
    errors.push("A capacidade total do caminhao deve ser maior que zero.");
  }

  if (input.compartments.length === 0) {
    errors.push("Cadastre pelo menos uma boca para o caminhao.");
  }

  input.compartments.forEach((compartment, index) => {
    if (!Number.isFinite(compartment.capacityLiters) || compartment.capacityLiters <= 0) {
      errors.push(`A capacidade da boca ${index + 1} deve ser maior que zero.`);
    }
  });

  const compartmentsTotal = input.compartments.reduce((total, compartment) => total + compartment.capacityLiters, 0);

  if (compartmentsTotal > totalCapacityLiters) {
    errors.push("A soma das capacidades das bocas nao pode ser maior que a capacidade total do caminhao.");
  }

  if (compartmentsTotal < totalCapacityLiters) {
    warnings.push("A soma das bocas esta menor que a capacidade total. O restante ficara sem compartimento.");
  }

  const existingTruck = input.id ? trucks.find((truck) => truck.id === input.id) : undefined;

  if (existingTruck) {
    const currentTruckState = getTruckLoadState(existingTruck, allocations);

    if (currentTruckState.loadedLiters > totalCapacityLiters) {
      errors.push("A capacidade total informada ficou abaixo do volume ja alocado neste caminhao.");
    }

    const currentLoadByCompartment = new Map(
      currentTruckState.compartments.map((compartmentState) => [
        compartmentState.compartment.id,
        compartmentState.loadedLiters,
      ]),
    );

    input.compartments.forEach((compartment, index) => {
      const currentLoad = currentLoadByCompartment.get(compartment.id) ?? 0;

      if (currentLoad > compartment.capacityLiters) {
        errors.push(
          `A boca ${index + 1} ficaria abaixo do volume ja alocado (${currentLoad.toLocaleString("pt-BR")} L).`,
        );
      }
    });

    const nextCompartmentIds = new Set(input.compartments.map((compartment) => compartment.id));
    currentTruckState.compartments.forEach((compartmentState) => {
      if (!nextCompartmentIds.has(compartmentState.compartment.id) && compartmentState.loadedLiters > 0) {
        errors.push(`${compartmentState.compartment.label} ja possui volume alocado e nao pode ser removida agora.`);
      }
    });
  }

  return { errors, warnings };
}

export function validateOrderInput(input: OrderFormInput): ActionResult | null {
  if (!input.customer.trim()) {
    return { tone: "error", message: "Informe o cliente, unidade ou posto do pedido." };
  }

  if (!Number.isFinite(input.liters) || input.liters <= 0) {
    return { tone: "error", message: "Os litros do pedido devem ser maiores que zero." };
  }

  return null;
}

export function validateManualAllocation(
  input: AllocationInput,
  trucks: Truck[],
  orders: Order[],
  allocations: Allocation[],
): ActionResult | null {
  if (!Number.isFinite(input.liters) || input.liters <= 0) {
    return { tone: "error", message: "Informe um volume de litros maior que zero para a alocacao." };
  }

  const order = orders.find((currentOrder) => currentOrder.id === input.orderId);

  if (!order) {
    return { tone: "error", message: "Pedido nao encontrado para alocacao." };
  }

  const orderState = getOrderLoadState(order, allocations);

  if (orderState.remainingLiters <= 0) {
    return { tone: "error", message: `O pedido ${order.code} ja esta totalmente alocado.` };
  }

  if (input.liters > orderState.remainingLiters) {
    return {
      tone: "error",
      message: `O pedido ${order.code} possui apenas ${orderState.remainingLiters.toLocaleString("pt-BR")} L pendentes.`,
    };
  }

  const truck = getTruckById(trucks, input.truckId);

  if (!truck) {
    return { tone: "error", message: "Caminhao nao encontrado para a alocacao." };
  }

  const truckState = getTruckLoadState(truck, allocations);

  if (input.liters > truckState.remainingLiters) {
    return {
      tone: "error",
      message: `O ${truck.name} tem apenas ${truckState.remainingLiters.toLocaleString("pt-BR")} L livres.`,
    };
  }

  const compartmentState = truckState.compartments.find(
    (compartment) => compartment.compartment.id === input.compartmentId,
  );

  if (!compartmentState) {
    return { tone: "error", message: "Boca nao encontrada para o caminhao selecionado." };
  }

  if (input.liters > compartmentState.remainingLiters) {
    return {
      tone: "error",
      message: `${compartmentState.compartment.label} possui apenas ${compartmentState.remainingLiters.toLocaleString(
        "pt-BR",
      )} L disponiveis.`,
    };
  }

  if (compartmentState.fuelType && compartmentState.fuelType !== order.fuelType) {
    return {
      tone: "error",
      message: `${compartmentState.compartment.label} ja esta carregada com ${
        FUEL_MAP[compartmentState.fuelType].label
      } e nao pode misturar combustiveis.`,
    };
  }

  return null;
}

export function suggestOrderAllocations(
  order: Order,
  trucks: Truck[],
  allocations: Allocation[],
): SuggestionResult {
  const orderState = getOrderLoadState(order, allocations);
  let remainingLiters = orderState.remainingLiters;
  const workingAllocations = [...allocations];
  const suggestions: SuggestionResult["allocations"] = [];

  while (remainingLiters > 0) {
    const candidates = trucks
      .map((truck) => getTruckLoadState(truck, workingAllocations))
      .flatMap((truckState) =>
        truckState.compartments
          .filter((compartmentState) => {
            if (compartmentState.remainingLiters <= 0) {
              return false;
            }

            if (truckState.remainingLiters <= 0) {
              return false;
            }

            return !compartmentState.fuelType || compartmentState.fuelType === order.fuelType;
          })
          .map((compartmentState) => ({
            truckState,
            compartmentState,
            sameFuel: compartmentState.fuelType === order.fuelType,
          })),
      )
      .sort((left, right) => {
        if (left.sameFuel !== right.sameFuel) {
          return left.sameFuel ? -1 : 1;
        }

        return right.compartmentState.remainingLiters - left.compartmentState.remainingLiters;
      });

    const candidate = candidates[0];

    if (!candidate) {
      break;
    }

    const liters = Math.min(
      remainingLiters,
      candidate.compartmentState.remainingLiters,
      candidate.truckState.remainingLiters,
    );

    if (liters <= 0) {
      break;
    }

    suggestions.push({
      orderId: order.id,
      truckId: candidate.truckState.truck.id,
      compartmentId: candidate.compartmentState.compartment.id,
      fuelType: order.fuelType,
      liters,
      reason: candidate.sameFuel
        ? "Aproveita uma boca ja configurada com o mesmo combustivel."
        : "Usa uma boca livre com capacidade valida para o pedido.",
    });

    workingAllocations.push({
      id: `draft_${suggestions.length}`,
      orderId: order.id,
      truckId: candidate.truckState.truck.id,
      compartmentId: candidate.compartmentState.compartment.id,
      fuelType: order.fuelType,
      liters,
      createdAt: new Date().toISOString(),
    });

    remainingLiters -= liters;
  }

  return {
    allocations: suggestions,
    remainingLiters,
  };
}

export function planAutomaticAllocation(
  orders: Order[],
  trucks: Truck[],
  allocations: Allocation[],
): AutoAllocationPlan {
  const pendingOrders = orders
    .map((order) => getOrderLoadState(order, allocations))
    .filter((orderState) => orderState.remainingLiters > 0)
    .sort((left, right) => right.remainingLiters - left.remainingLiters);

  const plan: AutoAllocationPlan = {
    allocations: [],
    unresolvedOrders: [],
    processedOrders: pendingOrders.length,
  };

  let workingAllocations = [...allocations];

  pendingOrders.forEach((orderState) => {
    const suggestion = suggestOrderAllocations(orderState.order, trucks, workingAllocations);

    suggestion.allocations.forEach((allocation) => {
      plan.allocations.push(allocation);
      workingAllocations.push({
        id: `draft_${plan.allocations.length}`,
        orderId: allocation.orderId,
        truckId: allocation.truckId,
        compartmentId: allocation.compartmentId,
        fuelType: allocation.fuelType,
        liters: allocation.liters,
        createdAt: new Date().toISOString(),
      });
    });

    if (suggestion.remainingLiters > 0) {
      plan.unresolvedOrders.push({
        orderId: orderState.order.id,
        remainingLiters: suggestion.remainingLiters,
      });
    }
  });

  return plan;
}
