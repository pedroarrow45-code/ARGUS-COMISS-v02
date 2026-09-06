import { FUEL_MAP } from "./catalog";
import type {
  AlertItem,
  Allocation,
  FuelType,
  Order,
  OrderLoadState,
  OrderStatus,
  Truck,
  TruckLoadState,
} from "./types";

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function toPercent(loadedLiters: number, capacityLiters: number): number {
  if (capacityLiters <= 0) {
    return 0;
  }

  return clampPercent((loadedLiters / capacityLiters) * 100);
}

export function getTruckLoadState(truck: Truck, allocations: Allocation[]): TruckLoadState {
  const truckAllocations = allocations.filter((allocation) => allocation.truckId === truck.id);
  const loadedLiters = truckAllocations.reduce((total, allocation) => total + allocation.liters, 0);
  const remainingLiters = Math.max(0, truck.totalCapacityLiters - loadedLiters);
  const compartmentSumLiters = truck.compartments.reduce((total, compartment) => total + compartment.capacityLiters, 0);

  return {
    truck,
    loadedLiters,
    remainingLiters,
    utilizationPercentage: toPercent(loadedLiters, truck.totalCapacityLiters),
    compartmentSumLiters,
    compartmentGapLiters: truck.totalCapacityLiters - compartmentSumLiters,
    compartments: truck.compartments.map((compartment) => {
      const compartmentAllocations = truckAllocations.filter(
        (allocation) => allocation.compartmentId === compartment.id,
      );
      const compartmentLoadedLiters = compartmentAllocations.reduce(
        (total, allocation) => total + allocation.liters,
        0,
      );

      return {
        compartment,
        allocations: compartmentAllocations,
        loadedLiters: compartmentLoadedLiters,
        remainingLiters: Math.max(0, compartment.capacityLiters - compartmentLoadedLiters),
        fillPercentage: toPercent(compartmentLoadedLiters, compartment.capacityLiters),
        fuelType: compartmentAllocations[0]?.fuelType ?? null,
      };
    }),
  };
}

function getOrderStatus(allocatedLiters: number, totalLiters: number): OrderStatus {
  if (allocatedLiters <= 0) {
    return "pending";
  }

  if (allocatedLiters >= totalLiters) {
    return "allocated";
  }

  return "partial";
}

export function getOrderLoadState(order: Order, allocations: Allocation[]): OrderLoadState {
  const orderAllocations = allocations.filter((allocation) => allocation.orderId === order.id);
  const allocatedLiters = orderAllocations.reduce((total, allocation) => total + allocation.liters, 0);
  const remainingLiters = Math.max(0, order.liters - allocatedLiters);

  return {
    order,
    allocations: orderAllocations,
    allocatedLiters,
    remainingLiters,
    fillPercentage: toPercent(allocatedLiters, order.liters),
    status: getOrderStatus(allocatedLiters, order.liters),
  };
}

export function getDashboardSummary(trucks: Truck[], orders: Order[], allocations: Allocation[]) {
  const truckStates = trucks.map((truck) => getTruckLoadState(truck, allocations));
  const orderStates = orders.map((order) => getOrderLoadState(order, allocations));
  const totalCapacityLiters = trucks.reduce((total, truck) => total + truck.totalCapacityLiters, 0);
  const totalLoadedLiters = truckStates.reduce((total, truckState) => total + truckState.loadedLiters, 0);
  const totalRemainingLiters = totalCapacityLiters - totalLoadedLiters;
  const pendingOrders = orderStates.filter((orderState) => orderState.status === "pending");
  const partialOrders = orderStates.filter((orderState) => orderState.status === "partial");
  const allocatedOrders = orderStates.filter((orderState) => orderState.status === "allocated");
  const pendingLiters = orderStates.reduce((total, orderState) => total + orderState.remainingLiters, 0);

  return {
    truckStates,
    orderStates,
    totalCapacityLiters,
    totalLoadedLiters,
    totalRemainingLiters,
    pendingOrders,
    partialOrders,
    allocatedOrders,
    pendingLiters,
    utilizationPercentage: totalCapacityLiters > 0 ? (totalLoadedLiters / totalCapacityLiters) * 100 : 0,
  };
}

export function buildOperationalAlerts(trucks: Truck[], orders: Order[], allocations: Allocation[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  const truckStates = trucks.map((truck) => getTruckLoadState(truck, allocations));
  const orderStates = orders.map((order) => getOrderLoadState(order, allocations));

  orderStates
    .filter((orderState) => orderState.remainingLiters > 0)
    .sort((left, right) => right.remainingLiters - left.remainingLiters)
    .slice(0, 3)
    .forEach((orderState) => {
      alerts.push({
        id: `order_${orderState.order.id}`,
        tone: orderState.status === "pending" ? "error" : "warning",
        title: `${orderState.order.code} com pendencia`,
        description: `${orderState.order.customer} ainda precisa de ${orderState.remainingLiters.toLocaleString(
          "pt-BR",
        )} L de ${FUEL_MAP[orderState.order.fuelType].label.toLowerCase()}.`,
      });
    });

  truckStates.forEach((truckState) => {
    if (truckState.compartmentGapLiters > 0) {
      alerts.push({
        id: `gap_${truckState.truck.id}`,
        tone: "warning",
        title: `${truckState.truck.name} com capacidade livre sem boca`,
        description: `As bocas somam ${truckState.compartmentSumLiters.toLocaleString(
          "pt-BR",
        )} L para um total cadastrado de ${truckState.truck.totalCapacityLiters.toLocaleString("pt-BR")} L.`,
      });
    }

    if (truckState.remainingLiters <= truckState.truck.totalCapacityLiters * 0.1) {
      alerts.push({
        id: `capacity_${truckState.truck.id}`,
        tone: "warning",
        title: `${truckState.truck.name} proximo do limite`,
        description: `Restam apenas ${truckState.remainingLiters.toLocaleString(
          "pt-BR",
        )} L disponiveis no ${truckState.truck.identifier}.`,
      });
    }
  });

  return alerts.slice(0, 6);
}

export function getCompartmentFuelType(truckState: TruckLoadState, compartmentId: string): FuelType | null {
  return truckState.compartments.find((compartment) => compartment.compartment.id === compartmentId)?.fuelType ?? null;
}
