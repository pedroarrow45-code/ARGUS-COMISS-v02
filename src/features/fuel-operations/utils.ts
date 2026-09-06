import type { SeedData, Truck } from "./types";

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function cloneSeedData(seed: SeedData): SeedData {
  return {
    trucks: seed.trucks.map((truck) => ({
      ...truck,
      compartments: truck.compartments.map((compartment) => ({ ...compartment })),
    })),
    orders: seed.orders.map((order) => ({ ...order })),
    allocations: seed.allocations.map((allocation) => ({ ...allocation })),
  };
}

export function getTruckById(trucks: Truck[], truckId: string): Truck | undefined {
  return trucks.find((truck) => truck.id === truckId);
}
