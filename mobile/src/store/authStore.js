import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  init: async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        const res = await api.get('/users/me');
        set({ user: res.data });
      }
    } catch {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    } finally {
      set({ isLoading: false });
    }
  },

  setUser: (user) => set({ user }),

  updateUser: (data) => set((s) => ({ user: { ...s.user, ...data } })),

  logout: async () => {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    await api.post('/auth/logout', { refreshToken }).catch(() => {});
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    set({ user: null });
  },
}));

export default useAuthStore;
