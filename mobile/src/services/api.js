import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          await AsyncStorage.setItem('accessToken', res.data.accessToken);
          await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
          err.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return api.request(err.config);
        } catch {
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
