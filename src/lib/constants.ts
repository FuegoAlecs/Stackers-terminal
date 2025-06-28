export const APP_NAME = 'My App'
export const APP_DESCRIPTION = 'A modern React application built with Vite and TypeScript'

export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  CONTACT: '/contact',
} as const

export const API_ENDPOINTS = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  USERS: '/users',
  POSTS: '/posts',
} as const

export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const