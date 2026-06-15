export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface HealthResponse {
    status: string;
    service: string;
    timestamp: string;
}

export interface ErrorResponse {
    success: false;
    error: string;
}
