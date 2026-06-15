export interface CreateProductDTO {
    skuInternal: string;
    nameCommercial: string;
    brandId: string;
    categoryId: string;
    costPriceAvg: number;
    salePriceBase: number;
    stockQuantity: number;
    minStockLevel: number;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
    id: string;
}

export interface ProductResponseDTO {
    id: string;
    skuInternal: string;
    nameCommercial: string;
    brandId: string;
    categoryId: string;
    costPriceAvg: number;
    salePriceBase: number;
    stockQuantity: number;
    minStockLevel: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
