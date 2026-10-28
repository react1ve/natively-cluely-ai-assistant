export declare const SALES_CARD_IDS: readonly string[];

export function withoutSalesCards<T extends { id: string; customPredicate?: unknown }>(stages: T[]): T[];
