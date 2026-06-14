import api from './api';
export const inventoryService = {
    getProducts: async (filters = {}) => {
        const { data } = await api.get('/inventory/products', { params: filters });
        // data = { success: true, data: X } where X may be array or { data: [...], meta: {...} }
        if (Array.isArray(data)) {
            return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 };
        }
        // Extract inner payload from standard { success, data: X } wrapper
        const payload = data?.data ?? data;
        if (Array.isArray(payload)) {
            return { data: payload, total: payload.length, page: 1, limit: payload.length, totalPages: 1 };
        }
        if (payload?.products) {
            return {
                data: Array.isArray(payload.products) ? payload.products : [],
                total: payload.total ?? payload.products?.length ?? 0,
                page: payload.page ?? 1,
                limit: payload.limit ?? 50,
                totalPages: payload.totalPages ?? 1,
            };
        }
        // Handle { data: [...], meta: { total, page, limit, totalPages } }
        if (payload?.data) {
            const items = Array.isArray(payload.data) ? payload.data : [];
            return {
                data: items,
                total: payload.meta?.total ?? payload.total ?? items.length,
                page: payload.meta?.page ?? payload.page ?? 1,
                limit: payload.meta?.limit ?? payload.limit ?? 50,
                totalPages: payload.meta?.totalPages ?? payload.totalPages ?? 1,
            };
        }
        return { data: [], total: 0, page: 1, limit: 50, totalPages: 0 };
    },
    getProduct: async (id) => {
        const { data } = await api.get(`/inventory/products/${id}`);
        return data.product ?? data;
    },
    createProduct: async (payload) => {
        const { data } = await api.post('/inventory/products', payload);
        return data.product ?? data;
    },
    updateProduct: async (id, payload) => {
        const { data } = await api.put(`/inventory/products/${id}`, payload);
        return data.product ?? data;
    },
    deleteProduct: async (id) => {
        await api.delete(`/inventory/products/${id}`);
    },
    adjustStock: async (id, payload) => {
        const { data } = await api.post(`/inventory/products/${id}/adjust-stock`, payload);
        return data.movement ?? data;
    },
    getCategories: async () => {
        const { data } = await api.get('/inventory/categories');
        if (Array.isArray(data))
            return data;
        const inner = data?.data ?? data;
        if (Array.isArray(inner))
            return inner;
        return Array.isArray(inner?.data) ? inner.data : [];
    },
    createCategory: async (name, description) => {
        const { data } = await api.post('/inventory/categories', { name, description });
        return data.category ?? data;
    },
    getMovements: async (productId) => {
        const params = productId ? { productId } : {};
        const { data } = await api.get('/inventory/movements', { params });
        return Array.isArray(data) ? data : data.movements ?? data.data ?? [];
    },
    importFromExcel: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/inventory/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },
    // ── Brands ──────────────────────────────────────────────────────────────
    getBrands: async (params) => {
        const { data } = await api.get('/inventory/brands', { params: { ...params, limit: params?.limit ?? 100 } });
        const result = data.data ?? data;
        return Array.isArray(result) ? result : result.data ?? [];
    },
    createBrand: async (payload) => {
        const { data } = await api.post('/inventory/brands', payload);
        return data.data ?? data;
    },
    updateBrand: async (id, payload) => {
        const { data } = await api.put(`/inventory/brands/${id}`, payload);
        return data.data ?? data;
    },
    deleteBrand: async (id) => {
        await api.delete(`/inventory/brands/${id}`);
    },
    // ── Categories (full CRUD) ───────────────────────────────────────────────
    getAllCategories: async (params) => {
        const { data } = await api.get('/inventory/categories', { params: { ...params, limit: params?.limit ?? 100 } });
        const result = data.data ?? data;
        return Array.isArray(result) ? result : result.data ?? [];
    },
    createFullCategory: async (payload) => {
        const { data } = await api.post('/inventory/categories', payload);
        return data.data ?? data;
    },
    updateCategory: async (id, payload) => {
        const { data } = await api.put(`/inventory/categories/${id}`, payload);
        return data.data ?? data;
    },
    deleteCategory: async (id) => {
        await api.delete(`/inventory/categories/${id}`);
    },
};
