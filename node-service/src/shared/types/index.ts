// Tipos base compartidos entre módulos

export interface BaseEntity {
  createdAt: number;
  updatedAt?: number;
}

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}
