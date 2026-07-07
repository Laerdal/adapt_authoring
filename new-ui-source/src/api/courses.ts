// Course API methods

import { apiClient } from "./client";
import type { Course, MenuPageData, ContentPageData, ApiResponse, PaginatedResponse } from "@/types";

// Fetch all courses (with optional filtering/sorting)
export async function getCourses(
  page: number = 1,
  pageSize: number = 20,
  search?: string
): Promise<PaginatedResponse<Course>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(search && { search }),
  });

  return apiClient.get(`/api/courses?${params}`);
}

// Fetch single course by ID
export async function getCourse(courseId: string): Promise<Course> {
  return apiClient.get(`/api/courses/${courseId}`);
}

// Create new course
export async function createCourse(data: {
  title: string;
  description?: string;
  instanceId?: string;
}): Promise<Course> {
  return apiClient.post("/api/courses", data);
}

// Update course metadata
export async function updateCourse(
  courseId: string,
  data: Partial<Course>
): Promise<Course> {
  return apiClient.put(`/api/courses/${courseId}`, data);
}

// Delete course
export async function deleteCourse(courseId: string): Promise<ApiResponse<null>> {
  return apiClient.delete(`/api/courses/${courseId}`);
}

// Publish course
export async function publishCourse(courseId: string): Promise<Course> {
  return apiClient.post(`/api/courses/${courseId}/publish`);
}

// Save menu page
export async function saveMenuPage(
  courseId: string,
  menuData: MenuPageData
): Promise<Course> {
  return apiClient.put(`/api/courses/${courseId}/menu`, menuData);
}

// Add content page
export async function addContentPage(
  courseId: string,
  pageData: Omit<ContentPageData, "id">
): Promise<ContentPageData> {
  return apiClient.post(`/api/courses/${courseId}/pages`, pageData);
}

// Update content page
export async function updateContentPage(
  courseId: string,
  pageId: string,
  pageData: Partial<ContentPageData>
): Promise<ContentPageData> {
  return apiClient.put(`/api/courses/${courseId}/pages/${pageId}`, pageData);
}

// Delete content page
export async function deleteContentPage(courseId: string, pageId: string): Promise<ApiResponse<null>> {
  return apiClient.delete(`/api/courses/${courseId}/pages/${pageId}`);
}

// Autosave (debounced save)
export async function autosaveCourse(courseId: string, data: Partial<Course>): Promise<Course> {
  return apiClient.patch(`/api/courses/${courseId}`, data);
}
