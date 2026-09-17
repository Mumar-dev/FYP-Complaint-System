import { BaseQueryFn } from '@reduxjs/toolkit/query/react';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';

export const axiosInstance = axios.create({
  // Fallback strictly matches Mongoose server endpoint for CORS/Cookies
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

export type CustomBaseQueryConfig = {
  url: string;
  method: AxiosRequestConfig['method'];
  data?: AxiosRequestConfig['data'];
  params?: AxiosRequestConfig['params'];
};

export const customBaseQuery = (): BaseQueryFn<
  CustomBaseQueryConfig,
  unknown,
  unknown
> => async ({ url, method, data, params }) => {
  try {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const axiosConfig: AxiosRequestConfig = {
      url,
      method,
      ...(isFormData ? { data } : { data, headers: { 'Content-Type': 'application/json' } }),
      params,
    };
    const result = await axiosInstance(axiosConfig);
    return { data: result.data };
  } catch (axiosError) {
    const err = axiosError as AxiosError;

    // Handle single 401 Unauthorized simple retry pattern without Mutex
    // Do NOT intercept or refresh if this request is already an auth endpoint (login, register, refresh)
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');
    const isAlreadyOnLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login');

    if (err.response?.status === 401 && !isAuthEndpoint) {
      try {
        // Call refresh endpoint
        await axiosInstance({ url: '/auth/refresh', method: 'POST' });
        
        // Retry the original request
        const retryResult = await axiosInstance({ url, method, data, params });
        return { data: retryResult.data };
      } catch (refreshError) {
        // If refresh fails, only redirect to login if not already on the login page
        if (!isAlreadyOnLoginPage) {
          window.location.href = '/login';
        }
        return {
          error: {
            status: err.response?.status,
            data: err.response?.data || err.message,
          },
        };
      }
    }

    return {
      error: {
        status: err.response?.status,
        data: err.response?.data || err.message,
      },
    };
  }
};
