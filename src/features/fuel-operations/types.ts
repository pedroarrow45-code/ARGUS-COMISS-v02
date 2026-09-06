export type AppTab = "dashboard" | "trucks" | "orders" | "planning" | "summary";

export type NoticeTone = "success" | "warning" | "error";

export type FuelType =
  | "gasolina_c"
  | "gasolina_aditivada"
  | "etanol"
  | "diesel_s10"
  | "diesel_s500";

export interface TruckCompartment {
  id: string;
  label: string;
  capacityLiters: number;
}

export interface Truck {
  id: string;
  name: string;
  identifier: string;
  totalCapacityLiters: number;
  compartments: TruckCompartment[];
}

export interface Order {
  id: string;
  code: string;
  customer: string;
  fuelType: FuelType;
  liters: number;
  createdAt: string;
}

export interface Allocation {
  id: string;
  orderId: string;
  truckId: string;
  compartmentId: string;
  fuelType: FuelType;
  liters: number;
  createdAt: string;
}

export interface Notice {
  tone: NoticeTone;
  message: string;
}

export interface ActionResult {
  tone: NoticeTone;
  message: string;
}

export interface TruckFormInput {
  id?: string;
  name: string;
  identifier: string;
  totalCapacityLiters: number;
  compartments: TruckCompartment[];
}

export interface OrderFormInput {
  customer: string;
  fuelType: FuelType;
  liters: number;
}

export interface AllocationInput {
  orderId: string;
  truckId: string;
  compartmentId: string;
  liters: number;
}

export interface CompartmentLoadState {
  compartment: TruckCompartment;
  allocations: Allocation[];
  loadedLiters: number;
  remainingLiters: number;
  fillPercentage: number;
  fuelType: FuelType | null;
}

export interface TruckLoadState {
  truck: Truck;
  compartments: CompartmentLoadState[];
  loadedLiters: number;
  remainingLiters: number;
  utilizationPercentage: number;
  compartmentSumLiters: number;
  compartmentGapLiters: number;
}

export type OrderStatus = "pending" | "partial" | "allocated";

export interface OrderLoadState {
  order: Order;
  allocations: Allocation[];
  allocatedLiters: number;
  remainingLiters: number;
  fillPercentage: number;
  status: OrderStatus;
}

export interface SuggestedAllocation {
  orderId: string;
  truckId: string;
  compartmentId: string;
  fuelType: FuelType;
  liters: number;
  reason: string;
}

export interface SuggestionResult {
  allocations: SuggestedAllocation[];
  remainingLiters: number;
}

export interface AutoAllocationPlan {
  allocations: SuggestedAllocation[];
  unresolvedOrders: Array<{
    orderId: string;
    remainingLiters: number;
  }>;
  processedOrders: number;
}

export interface AlertItem {
  id: string;
  tone: NoticeTone;
  title: string;
  description: string;
}

export interface SeedData {
  trucks: Truck[];
  orders: Order[];
  allocations: Allocation[];
}
