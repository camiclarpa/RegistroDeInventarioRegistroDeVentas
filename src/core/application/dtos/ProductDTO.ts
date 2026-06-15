export interface CreateProductDTO {
    skuInternal: string;
    partNumberOEM: string;
    nameCommercial: string;
    brandId: string;
    categoryId: string;
    locationBin: string;
    costPriceAvg: number;
    salePriceBase: number;
    stockQuantity?: number;
    minStockLevel?: number;
    descriptionTech?: string;
    taxRate?: number;
    warrantyDays?: number;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
    id: string;
}

export interface ProductResponseDTO {
    id: string;
    skuInternal: string;
    partNumberOEM: string;
    nameCommercial: string;
    brandId: string;
    categoryId: string;
    locationBin: string;
    costPriceAvg: number;
    salePriceBase: number;
    stockQuantity: number;
    minStockLevel: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
