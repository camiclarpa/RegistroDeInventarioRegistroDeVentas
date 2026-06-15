export interface KPIsResponseDTO {
    totalSales: number;
    totalProducts: number;
    totalCustomers: number;
    generatedAt: Date;
}

export interface ReportFiltersDTO {
    startDate?: Date;
    endDate?: Date;
    productId?: string;
    customerId?: string;
}
