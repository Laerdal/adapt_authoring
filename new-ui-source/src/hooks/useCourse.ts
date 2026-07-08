// Custom hook for course data fetching and management

import { useEffect, useState } from "react";
import type { Course } from "@/types";
import { getCourse, updateCourse } from "@/api";

interface UseCourseOptions {
  courseId: string;
  autoFetch?: boolean;
}

export function useCourse({ courseId, autoFetch = true }: UseCourseOptions) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);

  // Fetch course data
  useEffect(() => {
    if (!autoFetch || !courseId) return;

    const fetchCourse = async () => {
      try {
        setLoading(true);
        const data = await getCourse(courseId);
        setCourse(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch course"));
        setCourse(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId, autoFetch]);

  // Update course
  const updateCourseData = async (data: Partial<Course>) => {
    try {
      const updated = await updateCourse(courseId, data);
      setCourse(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to update course"));
      throw err;
    }
  };

  return {
    course,
    loading,
    error,
    updateCourse: updateCourseData,
  };
}
