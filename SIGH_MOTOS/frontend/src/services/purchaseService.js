import api from './api';
export const purchaseService = {
    getOrders: async (filters = {}) => {
        const { data } = await api.get('/purchases/orders', { params: filters });
        if (Array.isArray(data))
            return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 };
        // Unwrap { success: true, data: { orders: [...], total, page, ... } }
        const payload = data?.data ?? data;
        if (Array.isArray(payload))
            return { data: payload, total: payload.length, page: 1, limit: payload.length, totalPages: 1 };
        if (payload?.orders) {
            const orders = Array.isArray(payload.orders) ? payload.orders : [];
            return { data: orders, total: payload.total ?? orders.length, page: payload.page ?? 1, limit: payload.limit ?? 20, totalPages: payload.totalPages ?? 1 };
        }
        if (payload?.data) {
            const items = Array.isArray(payload.data) ? payload.data : [];
            return { data: items, total: payload.meta?.total ?? payload.total ?? items.length, page: payload.meta?.page ?? payload.page ?? 1, limit: payload.meta?.limit ?? payload.limit ?? 20, totalPages: payload.meta?.totalPages ?? payload.totalPages ?? 1 };
        }
        return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    },
    getOrder: async (id) => {
        const { data } = await api.get(`/purchases/orders/${id}`);
        return data.order ?? data;
    },
    createOrder: async (payload) => {
        const { data } = await api.post('/purchases/orders', payload);
        return data.order ?? data;
    },
    receiveOrder: async (id, items) => {
        const { data } = await api.put(`/purchases/orders/${id}/receive`, { items });
        return data.order ?? data;
    },
    cancelOrder: async (id, reason) => {
        await api.post(`/purchases/orders/${id}/cancel`, { reason });
    },
    getSuppliers: async (search) => {
        const { data } = await api.get('/suppliers', { params: { search, limit: 50 } });
        return Array.isArray(data) ? data : data.suppliers ?? data.data ?? [];
    },
    createSupplier: async (payload) => {
        const { data } = await api.post('/suppliers', payload);
        return data.supplier ?? data;
    },
    updateSupplier: async (id, payload) => {
        const { data } = await api.put(`/suppliers/${id}`, payload);
        return data.supplier ?? data;
    },
};
