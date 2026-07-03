// Course, Module, and Content Types

export interface Course {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  savedDate?: string; // For display
  status: "Draft" | "Published" | "Archived";
  step?: string; // e.g., "Step 3/6"
  instanceId?: string; // Workspace/instance reference
  menuPage?: MenuPageData;
  pages: ContentPageData[];
}

export interface MenuPageData {
  id?: string;
  logoUrl: string | null;
  title: string;
  subtitle: string;
  body: string;
  menuStyle: "Box Menu" | "Linear Menu" | "Icon Menu"; // Extend as needed
  menuLockType: string;
  textAlign: "left" | "center" | "right";
  bgType: "Color" | "Image" | "Gradient";
  bgColor?: string; // Hex color
  bgImageUrl?: string | null;
}

export interface ContentPageData {
  id: string;
  title: string;
  description: string;
  articles: ArticleData[];
  subPages: SubPageData[];
  order?: number; // For sorting pages
}

export interface ArticleData {
  id: string;
  title: string;
  content?: string;
  order?: number;
}

export interface SubPageData {
  id: string;
  title: string;
  description?: string;
  articles?: ArticleData[];
  order?: number;
}

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

// Filter/Sort Types
export type CourseSortOption = "Recently Modified" | "Alphabetical" | "Date Created";
export type CourseViewMode = "grid" | "list";
export type CourseStatus = "Draft" | "Published" | "Archived";
