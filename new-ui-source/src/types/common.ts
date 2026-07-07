// Shared Common Types

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: "admin" | "author" | "viewer";
}

export interface Instance {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  owner: User;
}

export interface Breadcrumb {
  label: string;
  href?: string;
  active?: boolean;
}

// UI Component Props (common patterns)
export interface BaseProps {
  className?: string;
  children?: React.ReactNode;
}

export interface WithRef<T> {
  ref?: React.Ref<T>;
}

// Form types
export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormState {
  isSubmitting: boolean;
  errors: FormFieldError[];
  touched: Record<string, boolean>;
}
