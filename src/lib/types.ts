export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface Post {
  id: string
  title: string
  content: string
  author: User
  createdAt: Date
  updatedAt: Date
  published: boolean
}

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

export interface ApiError {
  message: string
  code: string
  details?: Record<string, any>
}