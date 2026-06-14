import api from './api';
export const authService = {
    login: async (credentials) => {
        const { data } = await api.post('/auth/login', credentials);
        // Backend devuelve { success: true, data: { token, user } }
        if (data.data?.token && data.data?.user)
            return data.data;
        if (data.token && data.user)
            return data;
        throw new Error('Respuesta de login inesperada');
    },
    // GET /api/v1/auth/me — requiere token en Authorization header
    me: async () => {
        const { data } = await api.get('/auth/me');
        return data.data ?? data.user ?? data;
    },
    changePassword: async (currentPassword, newPassword) => {
        await api.post('/security/change-password', { currentPassword, newPassword });
    },
};
